import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FlowFile } from "./schema.js";
import {
  createFlow,
  deleteFlow,
  detachPageFromFlows,
  flowExists,
  readFlow,
  withoutScreen,
  writeFlow,
} from "./store.js";

const created: string[] = [];

function flowsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "instant-elements-flow-"));
  created.push(dir);
  return dir;
}

const opts = (dir: string) => ({ flowsDir: dir, actor: "tester" });

/** 화면 셋 · 연결 둘 — a → b → c. */
function seed(dir: string, name = "demo"): string {
  const { slug } = createFlow(opts(dir), name);
  writeFlow(opts(dir), slug, (flow) => ({
    ...flow,
    start: "a",
    screens: [
      { slug: "a", version: "1.0.0" },
      { slug: "b", version: "1.0.0" },
      { slug: "c", version: "1.0.0" },
    ],
    edges: [
      { id: "e1", from: { slug: "a", nodeId: "n1" }, to: "b" },
      { id: "e2", from: { slug: "b", nodeId: "n2" }, to: "c" },
    ],
  }));
  return slug;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("withoutScreen", () => {
  const base: FlowFile = {
    version: "1.0.0",
    name: "demo",
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "tester",
    start: "a",
    screens: [
      { slug: "a", version: "1.0.0" },
      { slug: "b", version: "1.0.0" },
    ],
    edges: [
      { id: "e1", from: { slug: "a", nodeId: "n1" }, to: "b" },
      { id: "e2", from: { slug: "b", nodeId: "n2" }, to: "a" },
    ],
  };

  it("화면을 드나들던 연결을 함께 지운다", () => {
    // 한쪽 끝만 사라진 연결이 남으면 재생이 빈 화면으로 떨어진다.
    expect(withoutScreen(base, "b").edges).toEqual([]);
  });

  it("시작 화면을 빼면 남은 첫 화면이 시작이 된다", () => {
    expect(withoutScreen(base, "a").start).toBe("b");
  });

  it("마지막 화면을 빼면 시작점 키 자체가 사라진다", () => {
    // 빈 문자열을 남기면 "지정됨"으로 읽힌다.
    const empty = withoutScreen(withoutScreen(base, "a"), "b");
    expect(empty.screens).toEqual([]);
    expect("start" in empty).toBe(false);
  });

  it("원본을 건드리지 않는다", () => {
    withoutScreen(base, "a");
    expect(base.screens).toHaveLength(2);
    expect(base.start).toBe("a");
  });

  it("편입되지 않은 화면을 빼면 그대로다", () => {
    expect(withoutScreen(base, "zzz")).toEqual(base);
  });
});

describe("deleteFlow", () => {
  it("지우면 파일이 사라진다", () => {
    const dir = flowsDir();
    const slug = seed(dir);
    expect(deleteFlow(dir, slug)).toBe(true);
    expect(flowExists(dir, slug)).toBe(false);
  });

  it("이미 없으면 false — 오류가 아니다", () => {
    const dir = flowsDir();
    expect(deleteFlow(dir, "never-existed")).toBe(false);
  });
});

describe("detachPageFromFlows", () => {
  it("그 페이지를 쓰는 흐름만 손대고, 손댄 것의 slug 를 돌려준다", () => {
    const dir = flowsDir();
    const withB = seed(dir, "with-b");
    const { slug: without } = createFlow(opts(dir), "without-b");

    expect(detachPageFromFlows(opts(dir), "b")).toEqual([withB]);

    const after = readFlow(dir, withB);
    expect(after.screens.map((s) => s.slug)).toEqual(["a", "c"]);
    // b 를 드나들던 연결 둘이 모두 정리된다.
    expect(after.edges).toEqual([]);
    expect(readFlow(dir, without).screens).toEqual([]);
  });

  it("여러 흐름에 편입돼 있으면 전부 정리한다", () => {
    const dir = flowsDir();
    const one = seed(dir, "one");
    const two = seed(dir, "two");
    expect(detachPageFromFlows(opts(dir), "a").sort()).toEqual([one, two].sort());
    for (const slug of [one, two]) {
      expect(readFlow(dir, slug).screens.map((s) => s.slug)).toEqual(["b", "c"]);
      expect(readFlow(dir, slug).start).toBe("b");
    }
  });

  it("아무 흐름도 안 쓰면 빈 배열", () => {
    const dir = flowsDir();
    seed(dir);
    expect(detachPageFromFlows(opts(dir), "zzz")).toEqual([]);
  });
});
