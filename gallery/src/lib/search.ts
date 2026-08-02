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

/** 신규 표시가 붙어 있는 기간. */
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 24시간 안에 만들어졌으면 새 것으로 표시한다. */
export function isNew(entry: Entry, now = Date.now()): boolean {
  const created = Date.parse(entry.meta.createdAt);
  if (Number.isNaN(created)) return false;
  return now - created < NEW_WINDOW_MS;
}

/**
 * 신규 표시가 몇 시간 뒤 사라지나.
 *
 * 뱃지만 있고 기한이 없으면 "어제 봤을 때 N 이었는데 왜 없어졌지"를 나중에 묻게 된다.
 * 남은 시간을 툴팁으로 말해 두면 그 질문이 생기지 않는다. 0 시간은 없다 — 곧 사라져도
 * "1시간 뒤"라고 말하는 편이 "0시간 뒤"보다 사람 말에 가깝다.
 */
export function hoursUntilStale(entry: Entry, now = Date.now()): number {
  const created = Date.parse(entry.meta.createdAt);
  if (Number.isNaN(created)) return 0;
  return Math.max(1, Math.ceil((created + NEW_WINDOW_MS - now) / (60 * 60 * 1000)));
}

/**
 * 검색어에 걸린 부분을 잘라 낸다 — 하이라이트용.
 *
 * 정규식으로 치환하지 않는 이유: 검색어에 정규식 메타문자(`(`, `[`, `*` …)가 들어오면 터지거나
 * 엉뚱한 곳이 잡힌다. 사람이 검색창에 특수문자를 치는 건 드문 일이 아니다. 그래서 소문자로
 * 내린 사본에서 `indexOf` 로 위치만 찾고, 자를 때는 **원문**에서 잘라 대소문자를 보존한다.
 */
export function splitByMatch(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [{ text, hit: false }];

  const lower = text.toLowerCase();
  // 겹치는 구간을 하나로 합치려면 먼저 모든 매치를 모아 시작 위치로 정렬해야 한다.
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(term, from);
      if (at === -1) break;
      ranges.push([at, at + term.length]);
      from = at + term.length;
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  const parts: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false });
    parts.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

/**
 * 관련 컴포넌트 — 공유 검색어와 같은 분류로 점수를 매긴다.
 *
 * 상세 화면이 막다른 길이 되지 않게 하는 것이 목적이다. 검색어를 더 무겁게 치는 이유는
 * 분류(Composite 등)가 셋뿐이라 그것만으로는 "관련"이 거의 무의미해지기 때문이다.
 */
export function findRelated(entries: Entry[], target: Entry, limit = 6): Entry[] {
  const keywords = new Set(target.meta.keywords.map((k) => k.toLowerCase()));
  const scored = entries
    .filter((entry) => entry.name !== target.name)
    .map((entry) => {
      const shared = entry.meta.keywords.filter((k) => keywords.has(k.toLowerCase())).length;
      const sameCategory = entry.meta.category === target.meta.category ? 1 : 0;
      return { entry, score: shared * 3 + sameCategory };
    })
    // 분류만 같고 검색어가 하나도 안 겹치면 "관련"이라 부르기 민망하다 — 잘라 낸다.
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((item) => item.entry);
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
