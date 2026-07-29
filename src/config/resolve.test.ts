import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveConfig, builtinTokensFile, resolveTokensCss } from "./resolve.js";
import { DEFAULTS } from "./defaults.js";

const created: string[] = [];

function tempProject(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "instant-elements-cfg-"));
  created.push(root);
  for (const [name, content] of Object.entries(files)) {
    const file = join(root, name);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveConfig", () => {
  it("설정 파일이 없어도 완전한 기본값을 돌려준다", async () => {
    const root = tempProject({ "package.json": '{"name":"demo-app"}' });
    const config = await resolveConfig({ cwd: root });

    expect(config.root).toBe(root);
    expect(config.configFile).toBeNull();
    expect(config.elementsDir).toBe(join(root, DEFAULTS.elementsDir));
    expect(config.entriesDir).toBe(join(root, DEFAULTS.registryDir, "entries"));
    expect(config.indexFile).toBe(join(root, DEFAULTS.registryDir, "index.json"));
    expect(config.importAlias).toBe(DEFAULTS.importAlias);
    expect(config.gallery.port).toBe(9221);
    // gallery.title 기본값은 package.json 의 name.
    expect(config.gallery.title).toBe("demo-app");
    expect(config.validate.animation).toBe(true);
  });

  it("JSON 설정을 읽고 경로를 절대경로로 만든다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.json": JSON.stringify({
        elementsDir: "app/ui",
        importAlias: "~/ui",
        registryDir: "harness",
        gallery: { port: 4000, host: "0.0.0.0" },
        validate: { animation: false },
      }),
    });
    const config = await resolveConfig({ cwd: root });

    expect(config.configFile).toBe(join(root, "instant.config.json"));
    expect(config.elementsDir).toBe(join(root, "app/ui"));
    expect(config.importAlias).toBe("~/ui");
    expect(config.entriesDir).toBe(join(root, "harness", "entries"));
    expect(config.gallery.port).toBe(4000);
    expect(config.gallery.host).toBe("0.0.0.0");
    expect(config.validate.animation).toBe(false);
    // 지정하지 않은 검증 축은 기본값을 유지한다.
    expect(config.validate.colorLiterals).toBe(true);
  });

  it("TS 설정을 defineConfig 와 함께 읽는다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.ts": [
        "type C = { elementsDir?: string; importAlias?: string };",
        "const defineConfig = (c: C): C => c;",
        'export default defineConfig({ elementsDir: "src/design", importAlias: "@ds" });',
      ].join("\n"),
    });
    const config = await resolveConfig({ cwd: root });

    expect(config.elementsDir).toBe(join(root, "src/design"));
    expect(config.importAlias).toBe("@ds");
  });

  it("설정 파일이 없을 때만 package.json#instantElements 를 본다", async () => {
    const withField = tempProject({
      "package.json": JSON.stringify({ name: "x", instantElements: { elementsDir: "lib/ui" } }),
    });
    expect((await resolveConfig({ cwd: withField })).elementsDir).toBe(join(withField, "lib/ui"));

    // 설정 파일이 있으면 그쪽이 유일한 진실 — package.json 필드는 무시된다.
    const withBoth = tempProject({
      "package.json": JSON.stringify({ name: "x", instantElements: { elementsDir: "lib/ui" } }),
      "instant.config.json": JSON.stringify({ elementsDir: "src/ui" }),
    });
    expect((await resolveConfig({ cwd: withBoth })).elementsDir).toBe(join(withBoth, "src/ui"));
  });

  it("하위 디렉토리에서 실행해도 루트를 찾는다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.json": "{}",
    });
    const nested = join(root, "src", "features", "deep");
    mkdirSync(nested, { recursive: true });

    expect((await resolveConfig({ cwd: nested })).root).toBe(root);
  });

  it("오타난 최상위 키를 조용히 넘기지 않는다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.json": JSON.stringify({ elementDir: "src/ui" }),
    });
    await expect(resolveConfig({ cwd: root })).rejects.toThrow(/알 수 없는 설정 키 'elementDir'/);
  });

  it("프로젝트 밖을 가리키는 경로를 거부한다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.json": JSON.stringify({ elementsDir: "../outside" }),
    });
    await expect(resolveConfig({ cwd: root })).rejects.toThrow(/프로젝트 밖/);
  });

  it("절대경로 elementsDir 을 거부한다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.json": JSON.stringify({ elementsDir: "/etc" }),
    });
    await expect(resolveConfig({ cwd: root })).rejects.toThrow(/상대경로/);
  });

  it("잘못된 포트를 거부한다", async () => {
    const root = tempProject({
      "package.json": "{}",
      "instant.config.json": JSON.stringify({ gallery: { port: 99999 } }),
    });
    await expect(resolveConfig({ cwd: root })).rejects.toThrow(/gallery.port/);
  });
});

describe("resolveTokensCss", () => {
  it("기본 스펙은 라이브러리 내장 토큰으로 해석한다", () => {
    expect(resolveTokensCss(DEFAULTS.tokens.css, "/any/root")).toBe(builtinTokensFile);
  });

  it("프로젝트 상대경로는 루트 기준으로 해석한다", () => {
    expect(resolveTokensCss("src/styles/tokens.css", "/proj")).toBe("/proj/src/styles/tokens.css");
  });
});
