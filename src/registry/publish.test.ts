import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig } from "../config/resolve.js";
import type { ResolvedConfig } from "../config/types.js";
import { createElement, LIB_DIR_NAME } from "./create.js";
import { cnTemplate } from "./templates.js";
import { buildPublishBundle } from "./publish.js";

const created: string[] = [];

async function project(): Promise<ResolvedConfig> {
  const root = mkdtempSync(join(tmpdir(), "instant-elements-publish-"));
  created.push(root);
  writeFileSync(join(root, "package.json"), '{"name":"demo"}');
  const config = await resolveConfig({ cwd: root });
  mkdirSync(join(config.elementsDir, LIB_DIR_NAME), { recursive: true });
  writeFileSync(join(config.elementsDir, LIB_DIR_NAME, "cn.ts"), cnTemplate());
  return config;
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

describe("buildPublishBundle", () => {
  it("본체·데모·배럴·공유 cn 헬퍼 네 파일의 실제 내용을 담는다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "stat-card", ...base });

    const bundle = buildPublishBundle(config, entry);

    expect(bundle.name).toBe("stat-card");
    expect(bundle.files).toHaveLength(4);
    const byPath = Object.fromEntries(bundle.files.map((f) => [f.path, f]));

    expect(byPath["src/elements/stat-card/stat-card.tsx"]?.type).toBe("registry:component");
    expect(byPath["src/elements/stat-card/stat-card.tsx"]?.content).toContain("export function StatCard(");

    expect(byPath["src/elements/stat-card/stat-card.demo.tsx"]?.type).toBe("registry:file");
    expect(byPath["src/elements/stat-card/stat-card.demo.tsx"]?.content).toContain("export default function");

    expect(byPath["src/elements/stat-card/index.ts"]?.content).toBe('export * from "./stat-card";\n');

    expect(byPath["src/elements/_lib/cn.ts"]?.content).toContain("export function cn(");
  });

  it("$schema 와 meta 를 로컬 엔트리에서 그대로 옮긴다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "card", ...base, keywords: ["지표"] });

    const bundle = buildPublishBundle(config, entry);

    expect(bundle.$schema).toBe(entry.$schema);
    expect(bundle.meta).toEqual(entry.meta);
    expect(bundle.description).toBe(entry.description);
  });

  it("공유 cn 헬퍼가 없으면 발행을 막는다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "card", ...base });
    rmSync(join(config.elementsDir, LIB_DIR_NAME, "cn.ts"));

    expect(() => buildPublishBundle(config, entry)).toThrow(/공유 cn 헬퍼/);
  });

  it("데모 파일이 없으면 발행을 막는다", async () => {
    const config = await project();
    const { entry } = createElement(config, { name: "card", ...base });
    rmSync(join(config.elementsDir, "card", "card.demo.tsx"));

    expect(() => buildPublishBundle(config, entry)).toThrow(/데모/);
    expect(existsSync(join(config.elementsDir, "card", "card.tsx"))).toBe(true);
  });
});
