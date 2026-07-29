import type { ElementCategory, ElementStatus } from "../config/types.js";

/**
 * 레지스트리 엔트리 — 컴포넌트 하나에 대한 **단일 진실**.
 *
 * 최상위는 shadcn `registry-item.json` 과 호환되는 형태를 유지한다(도구 생태계와 어긋나지 않게).
 * 우리가 필요로 하는 추가 정보는 전부 `meta` 안에 둔다 — 그래야 표준 필드를 오염시키지 않는다.
 */

export const ENTRY_SCHEMA_URL = "https://ui.shadcn.com/schema/registry-item.json";

/** props 스키마 항목의 타입. `action` 은 문서용 표시가 아니라 흐름이 실제로 배선하는 지점이다. */
export type PropType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "token"
  | "action"
  | "array"
  | "object"
  | "node";

export interface PropSchema {
  name: string;
  type: PropType;
  required?: boolean;
  /**
   * 페이지 편집·프리뷰에서 값을 바꿀 수 있는 prop 인가. 내부 전용(className 등)은 false.
   */
  editable?: boolean;
  /** enum 일 때의 선택지. */
  options?: string[];
  /** token 일 때 참조하는 스케일 이름(spacing·radius·duration 등). */
  scale?: string;
  /** 프리뷰가 실제 값 없이도 그려지도록 채워 넣는 예시값. */
  mock?: unknown;
  /** 사람이 읽는 라벨. */
  label?: string;
  /** array 일 때 원소의 형태. */
  of?: PropSchema[];
}

export interface EntryFile {
  path: string;
  type: "registry:component" | "registry:file";
}

export interface EntryMeta {
  /** 라이프사이클 라벨. 자동 전이는 없다 — 사람이 붙이는 표시일 뿐. */
  status: ElementStatus;
  /** 재사용 판정과 갤러리 필터에 쓰는 분류. */
  category: ElementCategory;
  /** 요청 원문을 보존한 역할 한 문장. "왜 만들었나"의 근거라 재분석의 출발점이 된다. */
  intent: string;
  /** 카드·상세에 보여줄 담백한 설명 한 문장. 개발 용어 없이 누가 읽어도 이해되게. */
  summary: string;
  /** 검색어(한글+영문 함께). */
  keywords: string[];
  /** 이 컴포넌트가 조합해 쓰는 다른 엔트리 이름들. */
  composedOf?: string[];
  /** 실제로 참조하는 st-* 토큰들. */
  tokens?: string[];
  /** 구조화된 props 스키마. 자유 문자열이 아니다 — 페이지 조립이 이걸 읽어 실 컴포넌트를 그린다. */
  props?: PropSchema[];
  /** git user.name. */
  createdBy: string;
  /** ISO 8601. 실제 시각이어야 한다(대화 날짜는 자정으로 붕괴한다). */
  createdAt: string;
  /** 데모 파일 경로(프로젝트 루트 기준 상대). */
  demo?: string;
  /** named export 이름(PascalCase). */
  exportName?: string;
  /** 사용 예제 JSX 스니펫. */
  usage?: string;
  /** 애니메이션 계약. Phase 3 에서 검증이 붙는다. */
  animation?: unknown;
  /** 정당한 색 리터럴 예외 선언 — 주석 자율면제 대신 이 필드로만. */
  tokenExceptions?: { value: string; reason: string }[];
}

export interface Entry {
  $schema: string;
  name: string;
  type: "registry:component";
  description: string;
  files: EntryFile[];
  meta: EntryMeta;
}

/** index.json 에 담기는 경량 요약. 컨텍스트 비용을 줄이려고 최소 필드만 싣는다. */
export interface IndexComponent {
  name: string;
  status: ElementStatus;
  category: ElementCategory;
  intent: string;
  summary: string;
  keywords: string[];
  /** 노드로 쓸 수 있는가(= 데모가 있어 렌더 가능한가). 페이지 조립이 이 필드로 후보를 거른다. */
  hasDemo: boolean;
}

export interface RegistryIndex {
  generator: string;
  note: string;
  count: number;
  components: IndexComponent[];
}

/**
 * 히스토리 이벤트 — "무엇이 언제 왜 일어났나"의 append-only 기록.
 *
 * - `created`     최초 생성. 요청 원문이 `prompt` 에 그대로 남는다.
 * - `modified`    코드를 실제로 고쳤을 때. `sha` 가 있으면 그 커밋이 곧 복원 지점이다.
 * - `recommended` 신규 생성 대신 기존 컴포넌트를 추천했을 때. 코드는 안 바뀌지만 **이것만은 남긴다** —
 *                 없으면 하네스의 존재 이유인 재사용률을 영영 잴 수 없다.
 *
 * 타입이 여기(node 의존 0인 계약 파일)에 사는 이유: 갤러리는 브라우저 앱이라 `node:fs` 를 끌어오는
 * 모듈을 타입으로도 참조할 수 없다. 브라우저 경계를 넘는 타입은 전부 이 파일에 모은다.
 */
export type HistoryAction = "created" | "modified" | "recommended";

export const HISTORY_ACTIONS: HistoryAction[] = ["created", "modified", "recommended"];

export interface HistoryEvent {
  /** ISO 8601. 실제 시각이어야 한다. */
  at: string;
  /** git user.name (없으면 "unknown"). */
  actor: string;
  action: HistoryAction;
  /** 요청 원문. 개행·코드펜스·URL 을 그대로 보존한다. */
  prompt?: string;
  /** 무엇을 했는지 한 줄 요약. */
  note?: string;
  /** 이 변경의 코드 커밋 SHA. 갤러리 "복원"이 가리키는 지점. */
  sha?: string;
}

export function isHistoryAction(value: unknown): value is HistoryAction {
  return typeof value === "string" && (HISTORY_ACTIONS as string[]).includes(value);
}

export const CATEGORIES: ElementCategory[] = ["Composite", "Animations", "System"];
export const STATUSES: ElementStatus[] = ["draft", "stable"];

export function isCategory(value: unknown): value is ElementCategory {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

export function isStatus(value: unknown): value is ElementStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}
