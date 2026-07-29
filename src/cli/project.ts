import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** 설정 파일 이름 — 앞의 것이 이긴다. `.ts` 를 먼저 두는 건 타입 있는 설정을 기본으로 밀기 위함. */
export const CONFIG_FILENAMES = [
  "instant.config.ts",
  "instant.config.mts",
  "instant.config.js",
  "instant.config.mjs",
  "instant.config.json",
] as const;

/**
 * 프로젝트 루트 탐색 — `instant.config.*` 를 먼저 찾고, 없으면 `package.json` 이 있는 최상위 디렉토리로
 * 폴백한다. 설정이 아직 없는 상태(`ie init` 직전)에서도 루트를 알아야 하므로 두 단계로 나눈다.
 */
export function findProjectRoot(startDir: string): { root: string; configFile: string | null } {
  const start = resolve(startDir);
  let dir = start;
  let packageRoot: string | null = null;

  for (;;) {
    for (const name of CONFIG_FILENAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return { root: dir, configFile: candidate };
    }
    if (packageRoot === null && existsSync(join(dir, "package.json"))) packageRoot = dir;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return { root: packageRoot ?? start, configFile: null };
}

export interface GitInfo {
  installed: boolean;
  repository: boolean;
  userName: string | null;
}

/**
 * git 상태 — 히스토리 이벤트의 `actor` 와 SHA 복원이 여기 의존한다. git 이 없어도 라이브러리는
 * 동작하지만(actor 는 "unknown"), 기록의 가치가 크게 떨어지므로 doctor 가 경고한다.
 */
export function readGitInfo(cwd: string): GitInfo {
  const run = (args: string[]): string | null => {
    try {
      return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      return null;
    }
  };

  if (run(["--version"]) === null) return { installed: false, repository: false, userName: null };
  const repository = run(["rev-parse", "--is-inside-work-tree"]) === "true";
  const userName = run(["config", "user.name"]) || null;
  return { installed: true, repository, userName };
}

/** `20.11.0` 같은 문자열을 비교 가능한 숫자 튜플로. */
function parseVersion(v: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = v
    .replace(/^v/, "")
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  return [major, minor, patch];
}

export function satisfiesMinimum(actual: string, minimum: string): boolean {
  const a = parseVersion(actual);
  const m = parseVersion(minimum);
  for (let i = 0; i < 3; i += 1) {
    const av = a[i] ?? 0;
    const mv = m[i] ?? 0;
    if (av > mv) return true;
    if (av < mv) return false;
  }
  return true;
}
