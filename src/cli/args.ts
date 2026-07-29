/**
 * 최소 argv 파서 — `ie <command> [subcommand] [positionals…] [--flags]`.
 *
 * 의존성 0. 지원 형태:
 *   --flag              → true
 *   --flag=value        → "value"
 *   --flag value        → "value"   (다음 토큰이 `-`로 시작하지 않을 때)
 *   --no-flag           → false
 *   --                  → 이후는 전부 positional (에스케이프 해치)
 *
 * 같은 플래그가 반복되면 배열로 모은다(`--keyword a --keyword b`).
 */

export type FlagValue = string | boolean | (string | boolean)[];

export interface ParsedArgs {
  /** 첫 번째 non-flag 토큰. 없으면 undefined. */
  command?: string;
  /** command 를 뺀 나머지 non-flag 토큰들. */
  positionals: string[];
  flags: Record<string, FlagValue>;
}

/** 다음 토큰이 이 플래그의 값인가 — `-`로 시작하면 값이 아니라 다음 플래그다(음수 제외). */
function isValueToken(token: string | undefined): token is string {
  if (token === undefined) return false;
  if (!token.startsWith("-")) return true;
  // "-3", "-1.5" 같은 음수는 값으로 본다.
  return /^-\d/.test(token);
}

function assign(flags: Record<string, FlagValue>, key: string, value: string | boolean): void {
  const existing = flags[key];
  if (existing === undefined) {
    flags[key] = value;
    return;
  }
  flags[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, FlagValue> = {};
  let escaped = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === undefined) continue;

    if (escaped) {
      positionals.push(token);
      continue;
    }
    if (token === "--") {
      escaped = true;
      continue;
    }

    if (token.startsWith("--")) {
      const body = token.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        assign(flags, body.slice(0, eq), body.slice(eq + 1));
        continue;
      }
      if (body.startsWith("no-")) {
        assign(flags, body.slice(3), false);
        continue;
      }
      const next = argv[i + 1];
      if (isValueToken(next)) {
        assign(flags, body, next);
        i += 1;
        continue;
      }
      assign(flags, body, true);
      continue;
    }

    if (token.startsWith("-") && token.length > 1 && !/^-\d/.test(token)) {
      // 짧은 플래그는 묶음(-abc)을 풀지 않는다 — `-h`, `-v` 처럼 단일만 쓴다.
      const body = token.slice(1);
      const next = argv[i + 1];
      if (isValueToken(next)) {
        assign(flags, body, next);
        i += 1;
        continue;
      }
      assign(flags, body, true);
      continue;
    }

    positionals.push(token);
  }

  const [command, ...rest] = positionals;
  return { command, positionals: rest, flags };
}

/** 플래그를 문자열로. 없거나 boolean 이면 fallback. 배열이면 마지막 값(나중 지정이 이긴다). */
export function flagString(
  flags: Record<string, FlagValue>,
  key: string,
  fallback?: string,
): string | undefined {
  const raw = flags[key];
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  return typeof value === "string" ? value : fallback;
}

/** 플래그를 boolean 으로. 문자열이면 "false"/"0"만 false. */
export function flagBool(flags: Record<string, FlagValue>, key: string, fallback = false): boolean {
  const raw = flags[key];
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  return value !== "false" && value !== "0" && value !== "";
}

/** 반복 지정된 플래그를 문자열 배열로. 쉼표 구분(`--keyword a,b`)도 함께 푼다. */
export function flagList(flags: Record<string, FlagValue>, key: string): string[] {
  const raw = flags[key];
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}
