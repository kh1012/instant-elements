/**
 * 페이지 데이터 모델.
 *
 * 페이지는 **레지스트리 컴포넌트를 배치한 트리**다. 코드가 아니라 데이터라서, 에이전트가 말로
 * 조립하고 사람이 리뷰하고 되돌리는 일이 전부 한 JSON 파일 위에서 일어난다.
 *
 * 모든 노드는 유일한 `props.id` 를 갖는다 — 피드백이 그 id 로 정확히 같은 자리를 가리키고,
 * 흐름(Phase 3)이 그 id 에 화면 전환을 붙인다. id 가 바뀌면 그 연결이 끊긴다.
 */

/** 레이아웃 컨테이너 — 자식은 항상 `props.items` 에 둔다. */
export const CONTAINER_TYPES = ["Stack", "Row", "Grid", "Frame"] as const;
/** 자식을 갖지 않는 레이아웃 요소. */
export const LEAF_TYPES = ["Heading", "Text", "Spacer", "Placeholder"] as const;

export type ContainerType = (typeof CONTAINER_TYPES)[number];
export type LeafType = (typeof LEAF_TYPES)[number];

export function isContainerType(type: string): type is ContainerType {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}
export function isLeafType(type: string): type is LeafType {
  return (LEAF_TYPES as readonly string[]).includes(type);
}
export function isPrimitiveType(type: string): boolean {
  return isContainerType(type) || isLeafType(type);
}

/**
 * 영역 역할. 최상위 컨테이너에 주면 렌더가 실제 시맨틱 태그로 방출한다
 * (header→`<header>`, navigation→`<nav>`, main→`<main>`, footer→`<footer>`, sidebar→`<aside>`).
 * 나머지(hero·section·toolbar)는 조언용 태그일 뿐 구조를 바꾸지 않는다.
 */
export const LANDMARK_ROLES = ["header", "navigation", "main", "footer", "sidebar"] as const;
export const ADVISORY_ROLES = ["hero", "section", "toolbar"] as const;
export type LandmarkRole = (typeof LANDMARK_ROLES)[number];
export type NodeRole = LandmarkRole | (typeof ADVISORY_ROLES)[number];

export function isLandmarkRole(role: unknown): role is LandmarkRole {
  return typeof role === "string" && (LANDMARK_ROLES as readonly string[]).includes(role);
}

/** 폭 지정 방식. 자유 px 입력은 없다 — 값이 스케일 밖으로 흩어지면 페이지끼리 어긋난다. */
export type WidthMode = "fill" | "hug" | "fixed";

export interface NodeProps {
  /** 유일 식별자. 피드백·흐름이 이 값으로 노드를 가리킨다. */
  id: string;
  /** 컨테이너의 자식. `zones` 는 쓰지 않는다. */
  items?: PageNode[];

  // ── 의미 태그(렌더에 직접 그려지지 않고 사람·에이전트가 지목에 쓴다)
  /** 자유 별칭. "메인 SNB" 처럼 사람이 부르는 이름. */
  _label?: string;
  /** 영역 역할. 랜드마크 5종은 실제 DOM 태그를 바꾼다. */
  _role?: NodeRole;
  /** header·sidebar 랜드마크를 `position: sticky` 로. */
  _regionSticky?: "sticky";
  /** 사람이 잠근 노드 — 구조 변경을 피한다. */
  _locked?: boolean;
  /** 편집 중 숨김(대안 비교용). */
  hidden?: boolean;

  // ── 구조 props (실제 CSS 로 방출된다)
  _widthMode?: WidthMode;
  /** fixed 이거나 Grid 자식일 때. `"264px"` · `"1/4"` · `"23%"` 세 형태를 받는다. */
  _width?: string;
  _height?: string;
  _alignSelf?: "start" | "center" | "end" | "stretch";
  _padding?: number;
  /** 부모가 Grid 일 때만 유효. */
  _colSpan?: number;
  _gridColStart?: number;
  _gridRow?: number;

  [key: string]: unknown;
}

export interface PageNode {
  /** 프리미티브 이름 또는 레지스트리 엔트리 이름. */
  type: string;
  props: NodeProps;
}

export interface RootProps {
  /** 캔버스 크기 프리셋. */
  pageSize?: FrameId;
  /** 페이지 전체 정렬 컬럼(0=없음). */
  pageColumns?: 0 | 12 | 16;
  pageGutter?: number;
  pageMargin?: number;
  [key: string]: unknown;
}

export interface PageData {
  root: { props: RootProps };
  content: PageNode[];
  zones?: Record<string, PageNode[]>;
}

export interface PageFile {
  version: string;
  title: string;
  updatedAt: string;
  updatedBy: string;
  data: PageData;
}

/**
 * 해상도 프레임.
 *
 * 미리보기를 고정 크기 캔버스 안에 가둔다 — 페이지가 어느 해상도를 전제로 저작됐는지가
 * 화면에서 사라지지 않게 하기 위함이다. UI 에는 두 종만 노출하고, 데이터에 다른 값이 있으면
 * 존중은 하되 선택지로는 주지 않는다.
 */
export const FRAMES = {
  fhd: { id: "fhd", label: "FHD", width: 1920, height: 1080 },
  qhd: { id: "qhd", label: "QHD", width: 2560, height: 1440 },
  hd: { id: "hd", label: "HD", width: 1366, height: 768 },
  uhd: { id: "uhd", label: "UHD", width: 3840, height: 2160 },
} as const;

export type FrameId = keyof typeof FRAMES;
export const SELECTABLE_FRAMES: FrameId[] = ["fhd", "qhd"];
export const DEFAULT_FRAME: FrameId = "fhd";

export function resolveFrame(pageSize: unknown, override?: unknown): (typeof FRAMES)[FrameId] {
  // 흐름이 프레임을 지정하면 페이지 값을 이긴다 — 시연 중 캔버스가 화면마다 리사이즈되면 못 쓴다.
  for (const candidate of [override, pageSize]) {
    if (typeof candidate === "string" && candidate in FRAMES) {
      return FRAMES[candidate as FrameId];
    }
  }
  return FRAMES[DEFAULT_FRAME];
}

/** 히스토리 액션 화이트리스트. CLI 와 갤러리가 같은 집합을 공유한다. */
export const PAGE_HISTORY_ACTIONS = ["created", "edited", "refined", "restored"] as const;
export type PageHistoryAction = (typeof PAGE_HISTORY_ACTIONS)[number];

export function isPageHistoryAction(value: unknown): value is PageHistoryAction {
  return typeof value === "string" && (PAGE_HISTORY_ACTIONS as readonly string[]).includes(value);
}

export interface PageHistoryEvent {
  at: string;
  actor: string;
  action: PageHistoryAction;
  note?: string;
  version: string;
}

export function emptyPageData(): PageData {
  return { root: { props: { pageSize: DEFAULT_FRAME } }, content: [], zones: {} };
}
