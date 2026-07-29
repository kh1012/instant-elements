import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { packageRoot } from "./pkg.js";
import {
  allColorTokens,
  allowedRadiusClasses,
  allowedTextClasses,
  colorTokens,
  radius,
  recipeTokens,
  typeScale,
  zIndex,
} from "./tokens.js";

const stylesDir = join(packageRoot, "styles");
const colorsCss = readFileSync(join(stylesDir, "colors.css"), "utf8");
const tokensCss = readFileSync(join(stylesDir, "tokens.css"), "utf8");

/** `--color-st-<name>: …` 로 노출된 토큰 이름을 CSS 에서 뽑는다(@theme inline 블록의 실제 계약). */
function exposedColorTokens(css: string): Set<string> {
  return new Set([...css.matchAll(/--color-st-([a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
}

/** 특정 셀렉터 블록 안에서 정의된 `--st-<name>` 이름들. */
function definedInBlock(css: string, selector: string): Set<string> {
  const start = css.indexOf(selector);
  if (start < 0) return new Set();
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = css.slice(open, end);
  return new Set([...block.matchAll(/--st-([a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));
}

describe("토큰 매니페스트 ↔ CSS 정합", () => {
  const exposed = exposedColorTokens(colorsCss);

  it("매니페스트의 모든 색 토큰이 CSS 에 노출돼 있다", () => {
    const missing = allColorTokens.filter((name) => !exposed.has(name));
    expect(missing).toEqual([]);
  });

  it("CSS 에 노출된 색 토큰이 모두 매니페스트에 있다 — 어휘가 조용히 늘어나지 않게", () => {
    const known = new Set<string>(allColorTokens);
    const extra = [...exposed].filter((name) => !known.has(name)).sort();
    expect(extra).toEqual([]);
  });

  it("코어와 레시피 토큰 이름이 겹치지 않는다", () => {
    const overlap = colorTokens.filter((n) => (recipeTokens as readonly string[]).includes(n));
    expect(overlap).toEqual([]);
  });
});

describe("라이트/다크 대칭", () => {
  const light = definedInBlock(colorsCss, ":root {");
  const dark = definedInBlock(colorsCss, '[data-theme="dark"] {');
  const autoDark = definedInBlock(colorsCss, ':root:not([data-theme="light"])');

  it("라이트에서 정의한 토큰을 다크도 전부 정의한다", () => {
    const missing = [...light].filter((name) => !dark.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it("OS 추종 다크 블록이 명시 다크 블록과 같은 토큰을 정의한다", () => {
    expect([...autoDark].sort()).toEqual([...dark].sort());
  });

  it("노출된 토큰은 라이트에서 실제 값을 갖는다", () => {
    const exposed = exposedColorTokens(colorsCss);
    const missing = [...exposed].filter((name) => !light.has(name)).sort();
    expect(missing).toEqual([]);
  });
});

describe("비색상 토큰 ↔ CSS 정합", () => {
  it("radius 스케일 값이 CSS 와 같다", () => {
    for (const [name, value] of Object.entries(radius)) {
      expect(tokensCss).toContain(`--radius-${name}: ${value};`);
    }
  });

  it("타입 스케일 값이 CSS 와 같다", () => {
    for (const [name, value] of Object.entries(typeScale)) {
      expect(tokensCss).toContain(`--ie-step-${name}: ${value};`);
    }
  });

  it("z-index 값이 CSS 와 같고 유틸이 정의돼 있다", () => {
    for (const [name, value] of Object.entries(zIndex)) {
      expect(tokensCss).toContain(`--z-index-${name}: ${value};`);
      expect(tokensCss).toContain(`@utility z-${name} {`);
    }
  });
});

describe("검증용 허용 목록", () => {
  it("radius 클래스는 스케일 + none/full 로 닫혀 있다", () => {
    expect(allowedRadiusClasses).toEqual([
      "rounded-none",
      "rounded-xs",
      "rounded-sm",
      "rounded-md",
      "rounded-lg",
      "rounded-xl",
      "rounded-full",
    ]);
  });

  it("text-step 클래스가 타입 스케일에서 파생된다", () => {
    expect(allowedTextClasses).toEqual([
      "text-step-n2",
      "text-step-n1",
      "text-step-0",
      "text-step-1",
      "text-step-2",
      "text-step-3",
    ]);
  });
});
