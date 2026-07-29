/**
 * 페이지 버전 — semver.
 *
 * 저장할 때마다 기본 patch+1 이 오른다. 이 번호가 **낙관적 동시성**의 기준이다: 읽은 버전을
 * `--base` 로 되돌려주지 않으면 저장을 거부해, 그 사이 다른 사람이 한 편집을 조용히 덮어쓰는 일이 없다.
 */
export const SEMVER_RE = /^\d+\.\d+\.\d+$/;
export const INITIAL_VERSION = "1.0.0";

export type BumpKind = "major" | "minor" | "patch";

export function isBumpKind(value: unknown): value is BumpKind {
  return value === "major" || value === "minor" || value === "patch";
}

/** 레거시 정수 버전(19 또는 "19")을 1.0.(N-1) 로 옮긴다 — "1.0.0 = 최초"를 보존한다. */
export function migrateVersion(value: unknown): string {
  if (typeof value === "string" && SEMVER_RE.test(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return migrateVersion(Number(value));
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return `1.0.${value - 1}`;
  return INITIAL_VERSION;
}

export function bumpVersion(version: string, kind: BumpKind = "patch"): string {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((n) => Number.parseInt(n, 10) || 0);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** 최신순 정렬용 비교자. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
