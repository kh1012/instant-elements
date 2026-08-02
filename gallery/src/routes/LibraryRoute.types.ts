import type { ElementCategory } from "instant-elements/registry";

/**
 * 라이브러리 화면의 축들.
 *
 * 타입과 라벨을 라우트 본문에서 떼어 낸 이유: 툴바·결과·URL 동기화가 **같은 값**을 봐야 하는데,
 * 세 파일이 각자 문자열을 적으면 하나만 고쳤을 때 조용히 어긋난다(필터는 걸리는데 칩은 안 눌린
 * 것처럼 보이는 식).
 */

/** 활동 축 — "방금 뭘 건드렸더라"에 답한다. 분류보다 자주 쓰인다. */
export type Activity = "all" | "new" | "running" | "touched";

export const ACTIVITY_LABEL: Record<Activity, string> = {
  all: "전체",
  new: "새로 생김",
  running: "실행 중",
  touched: "오늘 수정됨",
};

export const ACTIVITY_NOTE: Record<Activity, string> = {
  all: "모든 컴포넌트",
  new: "최근 24시간 안에 만들어진 것",
  running: "지금 에이전트가 고치고 있는 것",
  touched: "오늘 히스토리가 남은 것",
};

export const ACTIVITIES: Activity[] = ["all", "new", "running", "touched"];

export type CategoryFilter = ElementCategory | "all";
export const CATEGORIES: CategoryFilter[] = ["all", "Composite", "Animations", "System"];

/** 정렬 — "자주 씀"은 조회 기록 저장소가 따로 필요해 아직 없다. */
export type Sort = "name" | "recent" | "category";

export const SORT_LABEL: Record<Sort, string> = {
  name: "이름순",
  recent: "최신순",
  category: "분류순",
};

export type View = "grid" | "list";

/**
 * 카드 미리보기를 어떻게 그릴지.
 *
 * `live` 는 실제 데모를 렌더한다 — 한눈에 들어오지만 컴포넌트가 수십 개면 무거워진다.
 * `summary` 는 이름과 설명만 남긴다. 목록이 길어졌을 때 빠져나갈 구멍이다.
 */
export type CardMode = "live" | "summary";

export type Density = "comfortable" | "compact";

export interface LibraryQuery {
  activity: Activity;
  category: CategoryFilter;
  /** deprecated 를 **함께** 보여줄지. 다른 축과 독립이라 별개 값이다. */
  deprecated: boolean;
  sort: Sort;
  view: View;
  card: CardMode;
  density: Density;
}

/**
 * 기본값. URL 에서는 이 값과 같은 파라미터를 **지운다** — 아무것도 안 건드린 목록의 주소가
 * `?activity=all&sort=name&view=grid…` 로 길어지면 공유할 때 무엇이 의미 있는 값인지 알 수 없다.
 */
export const DEFAULT_QUERY: LibraryQuery = {
  activity: "all",
  category: "all",
  deprecated: false,
  sort: "name",
  view: "grid",
  card: "live",
  density: "comfortable",
};
