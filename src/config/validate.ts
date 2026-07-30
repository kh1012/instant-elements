import { CliError } from "../cli/ui.js";
import type { InstantElementsConfig } from "./types.js";

/**
 * 설정 검증 — 스키마 라이브러리 대신 손으로 쓴다.
 *
 * 이 설정은 사람이 손으로 쓰거나 에이전트가 생성한다. 둘 다 "무엇이 왜 틀렸는지"를 한국어 한 줄로
 * 읽어야 고칠 수 있어서, 범용 스키마 에러 문자열보다 직접 쓴 메시지가 낫다(의존성도 0으로 유지).
 */

function fail(message: string, hint?: string): never {
  throw new CliError(`설정 오류 — ${message}`, { exitCode: 78, ...(hint ? { hint } : {}) });
}

function assertRelativeDir(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "")
    fail(`${field} 는 비어 있지 않은 문자열이어야 합니다.`);
  const dir = value.trim();
  if (dir.startsWith("/") || /^[A-Za-z]:[\\/]/.test(dir))
    fail(`${field} 는 프로젝트 루트 기준 상대경로여야 합니다: ${dir}`, "예: \"src/elements\"");
  if (dir.split(/[\\/]/).includes(".."))
    fail(`${field} 가 프로젝트 밖을 가리킵니다: ${dir}`, "'..' 는 쓸 수 없습니다.");
  return dir.replace(/[\\/]+$/, "");
}

function assertPort(value: unknown): number {
  if (value === undefined) return 0;
  const port = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    fail(`gallery.port 는 1~65535 정수여야 합니다: ${String(value)}`);
  return port;
}

/** 알 수 없는 최상위 키는 조용히 무시하지 않는다 — 오타(`elementDir`)가 기본값으로 조용히 넘어가면 못 찾는다. */
const KNOWN_KEYS = new Set([
  "elementsDir",
  "importAlias",
  "registryDir",
  "pagesDir",
  "flowsDir",
  "tokens",
  "gallery",
  "validate",
  "publish",
]);

export interface NormalizedInput {
  elementsDir?: string;
  importAlias?: string;
  registryDir?: string;
  pagesDir?: string;
  flowsDir?: string;
  tokensCss?: string;
  galleryPort?: number;
  galleryHost?: string;
  galleryOpen?: boolean;
  galleryTitle?: string;
  validateColorLiterals?: boolean;
  validateArbitraryValues?: boolean;
  validateAnimation?: boolean;
  publishUrl?: string;
  publishOauthClientId?: string;
}

/** 원시 설정 객체를 검증하고 평평한 중간 형태로 정규화한다(기본값 병합은 resolve 가 한다). */
export function validateConfig(raw: unknown, source: string): NormalizedInput {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw))
    fail(`${source} 는 객체를 default export 해야 합니다.`);

  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!KNOWN_KEYS.has(key))
      fail(
        `알 수 없는 설정 키 '${key}' (${source})`,
        `사용 가능: ${[...KNOWN_KEYS].join(", ")}`,
      );
  }

  const out: NormalizedInput = {};

  if (input["elementsDir"] !== undefined)
    out.elementsDir = assertRelativeDir(input["elementsDir"], "elementsDir");
  if (input["registryDir"] !== undefined)
    out.registryDir = assertRelativeDir(input["registryDir"], "registryDir");
  if (input["pagesDir"] !== undefined)
    out.pagesDir = assertRelativeDir(input["pagesDir"], "pagesDir");
  if (input["flowsDir"] !== undefined)
    out.flowsDir = assertRelativeDir(input["flowsDir"], "flowsDir");

  if (input["importAlias"] !== undefined) {
    const alias = input["importAlias"];
    if (typeof alias !== "string" || alias.trim() === "")
      fail("importAlias 는 비어 있지 않은 문자열이어야 합니다.");
    out.importAlias = alias.trim().replace(/\/+$/, "");
  }

  const tokens = input["tokens"];
  if (tokens !== undefined) {
    if (typeof tokens !== "object" || tokens === null || Array.isArray(tokens))
      fail("tokens 는 객체여야 합니다.", '예: { css: "src/styles/tokens.css" }');
    const css = (tokens as Record<string, unknown>)["css"];
    if (css !== undefined) {
      if (typeof css !== "string" || css.trim() === "")
        fail("tokens.css 는 비어 있지 않은 문자열이어야 합니다.");
      out.tokensCss = css.trim();
    }
  }

  const gallery = input["gallery"];
  if (gallery !== undefined) {
    if (typeof gallery !== "object" || gallery === null || Array.isArray(gallery))
      fail("gallery 는 객체여야 합니다.", "예: { port: 9221 }");
    const g = gallery as Record<string, unknown>;
    if (g["port"] !== undefined) out.galleryPort = assertPort(g["port"]);
    if (g["host"] !== undefined) {
      if (typeof g["host"] !== "string" || g["host"].trim() === "")
        fail("gallery.host 는 비어 있지 않은 문자열이어야 합니다.");
      out.galleryHost = g["host"].trim();
    }
    if (g["open"] !== undefined) {
      if (typeof g["open"] !== "boolean") fail("gallery.open 은 boolean 이어야 합니다.");
      out.galleryOpen = g["open"];
    }
    if (g["title"] !== undefined) {
      if (typeof g["title"] !== "string") fail("gallery.title 은 문자열이어야 합니다.");
      out.galleryTitle = g["title"].trim();
    }
  }

  const validate = input["validate"];
  if (validate !== undefined) {
    if (typeof validate !== "object" || validate === null || Array.isArray(validate))
      fail("validate 는 객체여야 합니다.", "예: { animation: false }");
    const v = validate as Record<string, unknown>;
    for (const [key, target] of [
      ["colorLiterals", "validateColorLiterals"],
      ["arbitraryValues", "validateArbitraryValues"],
      ["animation", "validateAnimation"],
    ] as const) {
      if (v[key] === undefined) continue;
      if (typeof v[key] !== "boolean") fail(`validate.${key} 는 boolean 이어야 합니다.`);
      out[target] = v[key];
    }
  }

  const publish = input["publish"];
  if (publish !== undefined) {
    if (typeof publish !== "object" || publish === null || Array.isArray(publish))
      fail("publish 는 객체여야 합니다.", '예: { url: "https://registry.example.com" }');
    const p = publish as Record<string, unknown>;
    if (p["url"] !== undefined) {
      if (typeof p["url"] !== "string" || p["url"].trim() === "")
        fail("publish.url 은 비어 있지 않은 문자열이어야 합니다.");
      out.publishUrl = p["url"].trim().replace(/\/+$/, "");
    }
    if (p["oauthClientId"] !== undefined) {
      if (typeof p["oauthClientId"] !== "string" || p["oauthClientId"].trim() === "")
        fail("publish.oauthClientId 는 비어 있지 않은 문자열이어야 합니다.");
      out.publishOauthClientId = p["oauthClientId"].trim();
    }
  }

  return out;
}
