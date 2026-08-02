import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "../router";
import {
  ACTIVITIES,
  CATEGORIES,
  DEFAULT_QUERY,
  type Activity,
  type CardMode,
  type CategoryFilter,
  type Density,
  type LibraryQuery,
  type Sort,
  type View,
} from "./LibraryRoute.types";

/** URL 파라미터 이름. 짧게 — 공유 링크는 사람이 읽고 손으로 고치기도 한다. */
const KEYS: Record<keyof LibraryQuery, string> = {
  activity: "activity",
  category: "cat",
  deprecated: "dep",
  sort: "sort",
  view: "view",
  card: "card",
  density: "density",
};

function oneOf<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

function parse(search: string): LibraryQuery {
  const p = new URLSearchParams(search);
  return {
    activity: oneOf<Activity>(p.get(KEYS.activity), ACTIVITIES, DEFAULT_QUERY.activity),
    category: oneOf<CategoryFilter>(p.get(KEYS.category), CATEGORIES, DEFAULT_QUERY.category),
    deprecated: p.get(KEYS.deprecated) === "1",
    sort: oneOf<Sort>(p.get(KEYS.sort), ["name", "recent", "category"], DEFAULT_QUERY.sort),
    view: oneOf<View>(p.get(KEYS.view), ["grid", "list"], DEFAULT_QUERY.view),
    card: oneOf<CardMode>(p.get(KEYS.card), ["live", "summary"], DEFAULT_QUERY.card),
    density: oneOf<Density>(p.get(KEYS.density), ["comfortable", "compact"], DEFAULT_QUERY.density),
  };
}

/** 검색어(`q`)는 헤더가 쥐고 있어 여기 축에 없다 — 하지만 URL 에 쓸 때는 지우지 말아야 한다. */
function serialize(query: LibraryQuery, search: string): string {
  const p = new URLSearchParams(search);
  for (const key of Object.keys(KEYS) as (keyof LibraryQuery)[]) {
    const name = KEYS[key];
    const value = query[key];
    const isDefault = value === DEFAULT_QUERY[key];
    // 기본값이면 지운다 — 안 건드린 축이 주소에 남으면 무엇이 의미 있는 값인지 알 수 없다.
    if (isDefault) p.delete(name);
    else p.set(name, typeof value === "boolean" ? "1" : value);
  }
  return p.toString();
}

/**
 * 필터 상태를 URL 에 둔다 — 그래야 "찾아 놓은 목록"을 북마크하거나 남에게 보낼 수 있다.
 *
 * ── 히스토리를 어떻게 다루나
 * 필터를 만질 때마다 히스토리를 쌓으면 뒤로가기 열 번을 눌러야 목록을 빠져나간다. 반대로 전부
 * `replace` 로 하면 필터를 되돌릴 방법이 없다. 그래서 **처음 필터를 건 순간에만 push** 하고
 * 그 뒤 조정은 replace 한다 — 뒤로가기 한 번이면 "필터 걸기 전"으로 돌아간다.
 *
 * ── 마운트 때는 아무것도 쓰지 않는다
 * 첫 렌더에서 URL 을 정리해 버리면, 링크를 받은 사람의 주소창이 열자마자 바뀐다. 그리고 개인
 * 취향(밀도·뷰)이 남의 링크에 묻어 들어간다. 사람이 실제로 만졌을 때만 쓴다.
 */
export function useLibraryQueryState(): {
  query: LibraryQuery;
  set: <K extends keyof LibraryQuery>(key: K, value: LibraryQuery[K]) => void;
  reset: () => void;
  /** 기본값에서 벗어난 축이 하나라도 있는가 — "초기화" 버튼을 띄울 근거. */
  dirty: boolean;
} {
  const [query, setQuery] = useState<LibraryQuery>(() =>
    parse(typeof window === "undefined" ? "" : window.location.search),
  );

  /** 이번 방문에서 사람이 필터를 건드린 적이 있는가. push/replace 를 가르는 유일한 기준. */
  const touched = useRef(false);

  // 뒤로가기·앞으로가기로 주소가 바뀌면 화면이 따라가야 한다. 안 그러면 주소만 바뀌고 목록은 그대로다.
  useEffect(() => {
    const sync = () => {
      touched.current = false;
      setQuery(parse(window.location.search));
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const write = useCallback((next: LibraryQuery) => {
    setQuery(next);
    const search = serialize(next, window.location.search);
    const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
    navigate(url, { replace: touched.current });
    touched.current = true;
  }, []);

  const set = useCallback(
    <K extends keyof LibraryQuery>(key: K, value: LibraryQuery[K]) => {
      // 같은 값을 다시 고르면 히스토리에 빈 항목이 쌓인다.
      if (query[key] === value) return;
      write({ ...query, [key]: value });
    },
    [query, write],
  );

  const reset = useCallback(() => write({ ...DEFAULT_QUERY }), [write]);

  const dirty = (Object.keys(DEFAULT_QUERY) as (keyof LibraryQuery)[]).some(
    (key) => query[key] !== DEFAULT_QUERY[key],
  );

  return { query, set, reset, dirty };
}
