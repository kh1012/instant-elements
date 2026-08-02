import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * 헤더 검색창의 배선.
 *
 * ── 왜 라우트가 검색창을 그리지 않나
 * 검색을 라우트마다 그리면 화면을 옮길 때 입력창이 **언마운트됐다 다시 마운트된다** — 포커스가
 * 날아가고 한 프레임 깜빡인다. 그래서 검색창은 앱에서 딱 한 번 그려 두고 헤더의 빈 자리로
 * 포털하고(`SearchBox`), 라우트는 "무엇을 어떻게 찾을지"만 여기에 등록한다.
 *
 * ── 타이핑과 필터링을 나눈 이유
 * `value` 는 글자를 칠 때마다 바뀌지만 `committed` 는 Enter 를 눌러야 바뀐다. 목록이 수백 개일 때
 * 매 글자마다 필터를 다시 돌리면 입력이 눈에 띄게 밀린다. 라우트는 필터에 `committed` 를 쓰고,
 * 자동완성 같은 즉각 반응에만 `value` 를 쓴다.
 */

export interface SearchRegistration {
  /** 최근 검색어를 어디에 쌓을지. 컴포넌트 검색과 페이지 검색이 섞이면 둘 다 쓸모없어진다. */
  scope: string;
  placeholder: string;
  /** 자동완성 후보. 없으면 목록을 띄우지 않는다. */
  suggest?: (query: string) => { id: string; label: string; hint?: string }[];
  /** 후보를 골랐을 때. 없으면 그냥 검색어로 넣는다. */
  onPick?: (id: string) => void;
}

interface HeaderSearchValue {
  registration: SearchRegistration | null;
  register: (next: SearchRegistration | null) => void;
  /** 지금 입력창에 있는 글자. */
  value: string;
  setValue: (next: string) => void;
  /** 확정된 검색어 — 라우트는 이걸로 거른다. */
  committed: string;
  commit: (next: string) => void;
}

const HeaderSearchContext = createContext<HeaderSearchValue | null>(null);

export function HeaderSearchProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<SearchRegistration | null>(null);
  const [value, setValue] = useState("");
  const [committed, setCommitted] = useState("");

  const commit = useCallback((next: string) => {
    setValue(next);
    setCommitted(next);
  }, []);

  const value_ = useMemo<HeaderSearchValue>(
    () => ({ registration, register: setRegistration, value, setValue, committed, commit }),
    [registration, value, committed, commit],
  );

  return <HeaderSearchContext.Provider value={value_}>{children}</HeaderSearchContext.Provider>;
}

function useHeaderSearchContext(): HeaderSearchValue {
  const ctx = useContext(HeaderSearchContext);
  if (!ctx) throw new Error("헤더 검색은 HeaderSearchProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}

/** `SearchBox` 전용 — 입력창 자신이 쓰는 손잡이. */
export function useHeaderSearchBox(): HeaderSearchValue {
  return useHeaderSearchContext();
}

/**
 * 라우트가 "이 화면에서는 이렇게 찾는다"를 등록한다.
 *
 * 초기값(`initial`)은 URL 에서 온다 — 딥링크로 들어왔을 때 검색어가 반영돼 있어야 한다.
 */
export function useHeaderSearch(
  registration: SearchRegistration,
  initial = "",
): { value: string; committed: string } {
  const ctx = useHeaderSearchContext();
  const { register, commit } = ctx;
  const { scope, placeholder } = registration;

  /*
   * 콜백은 **정체성이 아니라 내용으로** 쓴다.
   *
   * 호출부는 `onPick: (name) => navigate(...)` 처럼 인라인 화살표를 넘기는 게 자연스럽고, 그건
   * 렌더마다 새 함수다. 그 정체성을 의존성 배열에 넣었더니 렌더 → 재등록 → 컨텍스트 상태 변경
   * → 렌더 의 고리가 생겨 **무한 루프가 났다**("Maximum update depth exceeded" 수천 건).
   *
   * 그래서 최신 콜백은 ref 에 담아 두고, 등록은 안정적인 값(범위·안내문·유무)이 바뀔 때만 한다.
   * 호출부가 useCallback 을 잊어도 안전한 쪽을 택했다 — 잊는 건 시간문제고, 그때 증상이 이렇다.
   */
  const latest = useRef(registration);
  latest.current = registration;

  const hasSuggest = Boolean(registration.suggest);
  const hasPick = Boolean(registration.onPick);

  useEffect(() => {
    register({
      scope,
      placeholder,
      ...(hasSuggest ? { suggest: (query: string) => latest.current.suggest?.(query) ?? [] } : {}),
      ...(hasPick ? { onPick: (id: string) => latest.current.onPick?.(id) } : {}),
    });
    // 화면을 떠나면 등록을 거둔다 — 안 그러면 검색을 안 쓰는 화면에도 입력창이 남는다.
    return () => register(null);
  }, [register, scope, placeholder, hasSuggest, hasPick]);

  /*
   * 화면이 바뀌면 검색어를 초기값으로 되돌린다. 컴포넌트에서 "card"를 치고 페이지로 넘어갔는데
   * 그 글자가 남아 있으면, 페이지 목록이 이유 없이 비어 보인다.
   */
  useEffect(() => {
    commit(initial);
    // 초기값은 마운트 시점의 URL 에서 한 번만 읽는다. 이후 타이핑까지 따라가면 매 글자마다 되돌아간다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, commit]);

  return { value: ctx.value, committed: ctx.committed };
}
