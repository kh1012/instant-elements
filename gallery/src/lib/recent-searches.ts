/** 한 범위에 남기는 최근 검색어 개수. 더 쌓아 봐야 목록이 길어져 고르기만 어려워진다. */
const LIMIT = 6;
const KEY_PREFIX = "ie:recent-search:";

/**
 * 최근 검색어.
 *
 * 서버에 두지 않는다 — 이건 이 브라우저를 쓰는 사람의 습관이지 프로젝트의 데이터가 아니다.
 * 레지스트리에 섞이면 커밋되어 남의 화면에도 내 검색 기록이 뜬다.
 */
export function readRecent(scope: string): string[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + scope);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // 사생활 보호 모드처럼 localStorage 가 막힌 환경 — 기록이 없을 뿐 검색은 되어야 한다.
    return [];
  }
}

export function pushRecent(scope: string, query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readRecent(scope);

  // 같은 말을 다시 찾으면 목록을 늘리는 게 아니라 맨 위로 올린다.
  const next = [trimmed, ...readRecent(scope).filter((v) => v !== trimmed)].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY_PREFIX + scope, JSON.stringify(next));
  } catch {
    /* 못 써도 이번 검색은 이미 됐다 */
  }
  return next;
}

export function clearRecent(scope: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + scope);
  } catch {
    /* 지울 게 없으면 그만이다 */
  }
}
