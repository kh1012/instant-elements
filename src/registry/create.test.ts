import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/resolve.js";
import type { ResolvedConfig } from "../config/types.js";
import { createElement, dedupeKeywords } from "./create.js";
import { readEntry } from "./entry.js";
import { readHistory } from "./history.js";
import { allColorTokens } from "../tokens.js";

const created: string[] = [];

async function project(): Promise<ResolvedConfig> {
  const root = mkdtempSync(join(tmpdir(), "instant-elements-create-"));
  created.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"demo"}');
  return resolveConfig({ cwd: root });
}

const base = {
  intent: "대시보드 상단에 쓸 지표 카드 만들어줘",
  summary: "숫자 하나와 변화량을 함께 보여주는 카드입니다.",
  createdBy: "tester",
};

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("createElement", () => {
  it("3파일 + 엔트리 + 히스토리를 함께 만든다", async () => {
    const config = await project();
    const result = createElement(config, { name: "stat-card", ...base });

    const dir = join(config.elementsDir, "stat-card");
    expect(existsSync(join(dir, "stat-card.tsx"))).toBe(true);
    expect(existsSync(join(dir, "stat-card.demo.tsx"))).toBe(true);
    expect(existsSync(join(dir, "index.ts"))).toBe(true);
    expect(existsSync(join(config.entriesDir, "stat-card.json"))).toBe(true);
    expect(result.indexCount).toBe(1);
  });

  it("엔트리에 계약 필드가 채워진다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "stat-card", ...base, keywords: ["지표"] });

    expect(entry.meta.status).toBe("draft");
    expect(entry.meta.category).toBe("Composite");
    expect(entry.meta.intent).toBe(base.intent);
    expect(entry.meta.summary).toBe(base.summary);
    expect(entry.meta.exportName).toBe("StatCard");
    expect(entry.meta.createdBy).toBe("tester");
    expect(entry.files[0]?.path).toBe("src/elements/stat-card/stat-card.tsx");
    expect(entry.meta.demo).toBe("src/elements/stat-card/stat-card.demo.tsx");
  });

  it("createdAt 이 실제 시각이다 — 자정으로 붕괴하지 않는다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "card", ...base });
    expect(entry.meta.createdAt).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(entry.meta.createdAt).not.toMatch(/T00:00:00\.000Z$/);
  });

  it("생성 이벤트에 요청 원문이 그대로 남는다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const history = readHistory(config, "card");
    expect(history).toHaveLength(1);
    expect(history[0]?.action).toBe("created");
    expect(history[0]?.prompt).toBe(base.intent);
  });

  it("같은 이름을 두 번 만들지 않는다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    expect(() => createElement(config, { name: "card", ...base })).toThrow(/이미 등록된/);
  });

  it("--force 로 덮어쓸 수 있다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const second = createElement(config, {
      name: "card",
      ...base,
      summary: "바뀐 설명입니다.",
      force: true,
    });
    expect(second.entry.meta.summary).toBe("바뀐 설명입니다.");
    expect(readEntry(config, "card").meta.summary).toBe("바뀐 설명입니다.");
  });

  it("엔트리 없이 디렉토리만 있으면 덮어쓰지 않고 알린다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    rmSync(join(config.entriesDir, "card.json"));
    expect(() => createElement(config, { name: "card", ...base })).toThrow(/디렉토리가 이미 있습니다/);
  });

  it("잘못된 이름을 거부한다", async () => {
    const config = await project();
    expect(() => createElement(config, { name: "Stat Card", ...base })).toThrow(/잘못된 컴포넌트 이름/);
    expect(() => createElement(config, { name: "../escape", ...base })).toThrow();
  });

  it("커스텀 exportName 을 존중한다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "gnb", ...base, exportName: "GlobalNavBar" });
    expect(entry.meta.exportName).toBe("GlobalNavBar");
    expect(readFileSync(join(config.elementsDir, "gnb", "gnb.tsx"), "utf8")).toContain(
      "export function GlobalNavBar(",
    );
  });
});

describe("스캐폴드 코드가 하드룰을 지킨다", () => {
  it("색 리터럴을 쓰지 않는다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const source = readFileSync(join(config.elementsDir, "card", "card.tsx"), "utf8");

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|oklab)\(/);
  });

  it("색은 실재하는 st-* 토큰만 참조한다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const source = readFileSync(join(config.elementsDir, "card", "card.tsx"), "utf8");

    const known = new Set<string>(allColorTokens);
    const used = [...source.matchAll(/\b(?:bg|text|border|ring|fill|stroke)-st-([a-z0-9-]+)/g)].map(
      (m) => m[1] as string,
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((t) => !known.has(t))).toEqual([]);
  });

  it("스케일 밖 arbitrary 값을 쓰지 않는다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const source = readFileSync(join(config.elementsDir, "card", "card.tsx"), "utf8");
    expect(source).not.toMatch(/\b(?:w|h|p|m|gap|text|rounded)[a-z]*-\[/);
  });

  it("데모는 default export 이고 props 없이 그려진다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const demo = readFileSync(join(config.elementsDir, "card", "card.demo.tsx"), "utf8");
    expect(demo).toMatch(/export default function \w+Demo\(\)/);
  });

  it("데모에 타이머·루프 애니메이션을 넣지 않는다", async () => {
    const config = await project();
    createElement(config, { name: "card", ...base });
    const demo = readFileSync(join(config.elementsDir, "card", "card.demo.tsx"), "utf8");
    expect(demo).not.toMatch(/setInterval|setTimeout|requestAnimationFrame|animate-/);
  });

  it("배럴이 컴포넌트를 re-export 한다", async () => {
    const config = await project();
    createElement(config, { name: "stat-card", ...base });
    expect(readFileSync(join(config.elementsDir, "stat-card", "index.ts"), "utf8")).toBe(
      'export * from "./stat-card";\n',
    );
  });
});

describe("dedupeKeywords", () => {
  it("이름과 이름 조각을 검색어에 보탠다", () => {
    expect(dedupeKeywords(["지표"], "stat-card")).toEqual(["지표", "stat-card", "stat", "card"]);
  });

  it("중복과 빈 값을 정리한다", () => {
    expect(dedupeKeywords(["card", "", "  ", "card"], "card")).toEqual(["card"]);
  });

  it("한 글자 조각은 보태지 않는다 — 검색 노이즈만 된다", () => {
    expect(dedupeKeywords([], "a-card")).toEqual(["a-card", "card"]);
  });
});
