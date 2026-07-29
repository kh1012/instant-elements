import type { Entry } from "instant-elements/registry";

/**
 * 검색 — 이름·설명·역할·검색어를 한 덩어리로 훑는다.
 *
 * 형태소 분석이나 퍼지 매칭을 넣지 않는다. 레지스트리는 수백 개 규모라 부분 문자열 매칭으로
 * 충분하고, 예측 가능한 결과가 "똑똑한" 결과보다 낫다 — 왜 안 나오는지 설명할 수 있어야 한다.
 */
function haystack(entry: Entry): string {
  return [entry.name, entry.meta.summary, entry.meta.intent, ...entry.meta.keywords]
    .join(" ")
    .toLowerCase();
}

export function searchEntries(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  // 공백으로 나눈 모든 조각을 포함해야 한다(AND) — 조건을 좁힐수록 결과가 줄어드는 게 직관적이다.
  const terms = q.split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const text = haystack(entry);
    return terms.every((term) => text.includes(term));
  });
}

/** 24시간 안에 만들어졌으면 새 것으로 표시한다. */
export function isNew(entry: Entry, now = Date.now()): boolean {
  const created = Date.parse(entry.meta.createdAt);
  if (Number.isNaN(created)) return false;
  return now - created < 24 * 60 * 60 * 1000;
}

export type SortKey = "name" | "recent";

export function sortEntries(entries: Entry[], key: SortKey): Entry[] {
  const copy = [...entries];
  if (key === "recent") {
    copy.sort((a, b) => Date.parse(b.meta.createdAt) - Date.parse(a.meta.createdAt));
  } else {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  return copy;
}
