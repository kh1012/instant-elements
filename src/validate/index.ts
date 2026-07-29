import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ResolvedConfig } from "../config/types.js";
import { listEntries, validateEntry } from "../registry/entry.js";
import { elementPaths } from "../registry/paths.js";
import type { Entry } from "../registry/schema.js";
import { allColorTokens } from "../tokens.js";
import { validateAnimation } from "../animation/contract.js";

/**
 * 검증 게이트 — 에이전트의 자율 준수가 놓친 하드룰을 기계적으로 잡는다.
 *
 * 자율 준수는 대체로 잘 되지만 **가끔** 놓친다. 그 가끔이 쌓이면 디자인 시스템이 조용히
 * 갈라지므로, 사람이 리뷰하기 전에 결정적으로 걸러 낸다.
 *
 * `block` 은 완료를 막고 `warn` 은 알리기만 한다 — 정당한 예외가 있는 축은 경고로 둔다.
 */

export interface Finding {
  level: "block" | "warn";
  name: string;
  file: string;
  line?: number;
  message: string;
  hint?: string;
}

export interface ValidateResult {
  findings: Finding[];
  checked: number;
  ok: boolean;
}

/** 유채색 리터럴. 순흑백(#000·#fff)은 마스크·그림자에 관용이 흔해 경고로 낮춘다. */
const HEX = /#([0-9a-fA-F]{3,8})\b/g;
const FUNCTIONAL_COLOR = /\b(rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/g;
/** Tailwind 팔레트 클래스(bg-blue-500 등) — st-* 토큰만 써야 한다. */
const PALETTE_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|shadow|outline|decoration|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
/** 스케일 대신 임의값을 쓴 자리. 기하값(translate·inset 등)은 대상에서 뺀다. */
const ARBITRARY = /\b(?:w|h|min-w|min-h|max-w|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|gap|text|rounded)-\[[^\]]+\]/g;

function isMonochrome(hex: string): boolean {
  const value = hex.length === 3 || hex.length === 4 ? hex.slice(0, 3) : hex.slice(0, 6);
  return /^(0{3,6}|f{3,6}|F{3,6})$/.test(value);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function scanSource(entry: Entry, file: string, source: string, config: ResolvedConfig): Finding[] {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], index: number, message: string, hint?: string) =>
    findings.push({
      level,
      name: entry.name,
      file,
      line: lineOf(source, index),
      message,
      ...(hint ? { hint } : {}),
    });

  const exceptions = new Set((entry.meta.tokenExceptions ?? []).map((e) => e.value));

  if (config.validate.colorLiterals) {
    for (const match of source.matchAll(HEX)) {
      const literal = match[0];
      if (exceptions.has(literal)) continue;
      if (isMonochrome(match[1] ?? "")) {
        add("warn", match.index, `순흑백 리터럴 ${literal}`, "정당하면 meta.tokenExceptions 에 선언하세요.");
      } else {
        add("block", match.index, `색 리터럴 ${literal}`, "st-* 토큰만 씁니다.");
      }
    }
    for (const match of source.matchAll(FUNCTIONAL_COLOR)) {
      if (exceptions.has(match[0])) continue;
      add("block", match.index, `색 함수 ${match[0]}…`, "st-* 토큰만 씁니다.");
    }
    for (const match of source.matchAll(PALETTE_CLASS)) {
      add("block", match.index, `팔레트 클래스 ${match[0]}`, "st-* 토큰 유틸로 바꾸세요.");
    }
  }

  if (config.validate.arbitraryValues) {
    for (const match of source.matchAll(ARBITRARY)) {
      add(
        "block",
        match.index,
        `스케일 밖 임의값 ${match[0]}`,
        "rounded-{xs..xl} · text-step-* · Tailwind 기본 간격 스케일을 쓰세요.",
      );
    }
  }

  // 알 수 없는 st-* 토큰 — 오타는 조용히 색이 안 나오는 것으로 끝나 발견이 늦다.
  const known = new Set<string>(allColorTokens);
  for (const match of source.matchAll(/\b(?:bg|text|border|ring|fill|stroke)-st-([a-z0-9-]+)/g)) {
    const token = match[1] ?? "";
    if (!known.has(token)) {
      add("block", match.index, `알 수 없는 토큰 st-${token}`, "오타이거나 아직 없는 토큰입니다.");
    }
  }

  return findings;
}

export function validateRegistry(
  config: ResolvedConfig,
  options: { only?: string; animationStrict?: boolean } = {},
): ValidateResult {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const entries = listEntries(dirs).filter((e) => !options.only || e.name === options.only);
  const findings: Finding[] = [];
  const rel = (path: string) => relative(config.root, path).split("\\").join("/");

  for (const entry of entries) {
    const paths = elementPaths(dirs, entry.name);
    const entryFile = rel(paths.entry);

    for (const problem of validateEntry(entry)) {
      findings.push({ level: "block", name: entry.name, file: entryFile, message: problem });
    }

    // 엔트리와 코드는 항상 쌍이다 — 한쪽만 있으면 갤러리에서 보이지 않거나 렌더되지 않는다.
    const sourceRel = entry.files[0]?.path;
    const sourcePath = sourceRel ? join(config.root, sourceRel) : paths.component;
    if (!existsSync(sourcePath)) {
      findings.push({
        level: "block",
        name: entry.name,
        file: entryFile,
        message: `코드 파일이 없습니다: ${sourceRel ?? rel(paths.component)}`,
      });
    } else {
      findings.push(...scanSource(entry, rel(sourcePath), readFileSync(sourcePath, "utf8"), config));
    }

    if (!existsSync(paths.demo)) {
      findings.push({
        level: "block",
        name: entry.name,
        file: entryFile,
        message: "데모 파일이 없습니다.",
        hint: "데모가 없으면 갤러리 카드가 비고 페이지 조립에서도 쓸 수 없습니다.",
      });
    } else {
      // 카드 프레임이 작다 — 목록에서 수십 개가 동시에 움직이면 읽을 수가 없다.
      const demo = readFileSync(paths.demo, "utf8");
      for (const match of demo.matchAll(/\b(setInterval|setTimeout|requestAnimationFrame)\b/g)) {
        findings.push({
          level: "warn",
          name: entry.name,
          file: rel(paths.demo),
          line: lineOf(demo, match.index),
          message: `데모에 ${match[0]} — 대표 상태 한 컷만 담습니다.`,
        });
      }
    }

    if (config.validate.animation || options.animationStrict) {
      for (const diagnostic of validateAnimation(entry.meta.category, entry.meta.animation, {
        name: entry.name,
      })) {
        findings.push({
          // --animation-strict 면 경고도 차단으로 올린다.
          level: options.animationStrict ? "block" : diagnostic.level,
          name: entry.name,
          file: entryFile,
          message: diagnostic.message,
          ...(diagnostic.hint ? { hint: diagnostic.hint } : {}),
        });
      }
    }
  }

  findings.sort((a, b) => `${a.file}:${a.line ?? 0}`.localeCompare(`${b.file}:${b.line ?? 0}`));
  return {
    findings,
    checked: entries.length,
    ok: findings.every((f) => f.level !== "block"),
  };
}
