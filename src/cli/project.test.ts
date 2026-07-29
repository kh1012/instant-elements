import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectRoot, satisfiesMinimum } from "./project.js";

const created: string[] = [];

function tempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "instant-elements-"));
  created.push(dir);
  return dir;
}

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("findProjectRoot", () => {
  it("상위로 올라가며 instant.config.* 를 찾는다", () => {
    const root = tempProject();
    writeFileSync(join(root, "instant.config.ts"), "export default {};");
    const nested = join(root, "src", "features");
    mkdirSync(nested, { recursive: true });

    const found = findProjectRoot(nested);
    expect(found.root).toBe(root);
    expect(found.configFile).toBe(join(root, "instant.config.ts"));
  });

  it("설정이 없으면 package.json 이 있는 디렉토리로 폴백한다", () => {
    const root = tempProject();
    writeFileSync(join(root, "package.json"), "{}");
    const nested = join(root, "src");
    mkdirSync(nested, { recursive: true });

    const found = findProjectRoot(nested);
    expect(found.root).toBe(root);
    expect(found.configFile).toBeNull();
  });

  it("설정이 package.json 보다 우선한다 — 더 깊은 곳의 설정이 이긴다", () => {
    const root = tempProject();
    writeFileSync(join(root, "package.json"), "{}");
    const pkg = join(root, "packages", "app");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, "instant.config.json"), "{}");

    const found = findProjectRoot(pkg);
    expect(found.root).toBe(pkg);
    expect(found.configFile).toBe(join(pkg, "instant.config.json"));
  });
});

describe("satisfiesMinimum", () => {
  it("major/minor/patch 를 순서대로 비교한다", () => {
    expect(satisfiesMinimum("20.11.0", "20.11.0")).toBe(true);
    expect(satisfiesMinimum("22.0.0", "20.11.0")).toBe(true);
    expect(satisfiesMinimum("20.12.0", "20.11.0")).toBe(true);
    expect(satisfiesMinimum("20.10.9", "20.11.0")).toBe(false);
    expect(satisfiesMinimum("18.20.0", "20.11.0")).toBe(false);
  });

  it("v 접두사를 무시한다", () => {
    expect(satisfiesMinimum("v20.11.0", "20.11.0")).toBe(true);
  });
});
