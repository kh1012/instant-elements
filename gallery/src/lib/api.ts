import type { PageData, PageHistoryEvent } from "instant-elements/page";

/**
 * 갤러리 서버 API 클라이언트.
 *
 * 페이지는 갤러리가 떠 있는 동안 CLI 가 계속 고치는 데이터라, 빌드 타임에 굳히지 않고
 * 필요할 때 가져온다.
 */

export interface PreviewNode {
  type: string;
  id?: string;
  cols?: number;
  items?: PreviewNode[];
}

export interface PageSummary {
  slug: string;
  title: string;
  version: string;
  updatedAt: string;
  updatedBy: string;
  nodes: number;
  /** 목록 썸네일이 그릴 얕은 구조. */
  preview: PreviewNode[];
  /** 미결 피드백 건수. */
  feedback: number;
}

export interface PageDetail {
  slug: string;
  exists: true;
  version: string;
  title: string;
  updatedAt: string;
  updatedBy: string;
  data: PageData;
  history: PageHistoryEvent[];
}

export interface FeedbackItem {
  id: string;
  nodeId?: string;
  nodeType?: string;
  comment: string;
  components?: string[];
  at: string;
  actor: string;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${path} → HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchPages(): Promise<{ count: number; pages: PageSummary[] }> {
  return get("/api/pages");
}

export function fetchPage(slug: string): Promise<PageDetail> {
  return get(`/api/pages/${encodeURIComponent(slug)}`);
}

/**
 * 서버가 실패를 설명하는 방식은 하나다 — `{ error: "사람이 읽는 문장" }`.
 *
 * 그걸 꺼내지 않으면 화면에 `HTTP 400 {"error":"title 이 비어 있습니다."}` 가 그대로 뜬다.
 * 사람에게 보여 줄 문장을 서버가 이미 썼는데 JSON 껍데기를 씌워 버리는 셈이다.
 *
 * 꺼낼 것이 없을 때만 상태 코드로 떨어진다(프록시가 가로챈 응답 등 — 그때는 경로와 코드가
 * 유일한 단서다).
 */
async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = typeof detail?.error === "string" ? detail.error : null;
    throw new Error(message ?? `${path} → HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

const feedbackUrl = (slug: string) => `/api/pages/${encodeURIComponent(slug)}/feedback`;

export function fetchFeedback(slug: string): Promise<{ items: FeedbackItem[] }> {
  return get(feedbackUrl(slug));
}

export function addFeedback(
  slug: string,
  input: { comment: string; nodeId?: string; nodeType?: string; components?: string[] },
): Promise<{ items: FeedbackItem[] }> {
  return send(feedbackUrl(slug), "POST", input);
}

export function editFeedback(
  slug: string,
  id: string,
  comment: string,
): Promise<{ items: FeedbackItem[] }> {
  return send(`${feedbackUrl(slug)}/${encodeURIComponent(id)}`, "PATCH", { comment });
}

export function deleteFeedback(slug: string, id: string): Promise<{ items: FeedbackItem[] }> {
  return send(`${feedbackUrl(slug)}/${encodeURIComponent(id)}`, "DELETE");
}

/** 항목 없이 부르면 전체 삭제 — 반영이 끝난 뒤 한 번에 비운다. */
export function clearFeedback(slug: string): Promise<{ items: FeedbackItem[] }> {
  return send(feedbackUrl(slug), "DELETE");
}

// ── 컴포넌트 고치기 (상태·복원)
//
// 둘 다 실행 중이면 서버가 409 로 막는다. 화면에서도 비활성으로 보여 주지만, 버튼을 누른 뒤
// 실행이 시작되는 경합이 있어 서버 쪽 확인이 진짜 방어선이다.

export interface RestorePoint {
  sha: string;
  at: string;
  actor: string;
  note?: string;
}

export function fetchRestorePoints(name: string): Promise<{ points: RestorePoint[] }> {
  return get(`/api/entry/${encodeURIComponent(name)}/restore-points`);
}

export function setEntryStatus(
  name: string,
  status: "draft" | "stable" | "deprecated",
): Promise<{ name: string; status: string; changed: boolean }> {
  return send(`/api/entry/${encodeURIComponent(name)}/status`, "POST", { status });
}

export function restoreEntry(
  name: string,
  sha: string,
): Promise<{ name: string; sha: string; files: string[]; commit: string }> {
  return send(`/api/entry/${encodeURIComponent(name)}/restore`, "POST", { sha });
}

// ── 페이지 고치기 (제목·버전 복원)

export interface PageVersion {
  version: string;
  title: string;
  updatedAt: string;
  updatedBy: string;
  /** 그 버전이 담고 있던 최상위 노드 수 — 무엇이 달라지는지 가늠할 단서. */
  nodes: number;
}

export function fetchPageVersions(
  slug: string,
): Promise<{ current: string; versions: PageVersion[] }> {
  return get(`/api/pages/${encodeURIComponent(slug)}/versions`);
}

export function setPageTitle(
  slug: string,
  title: string,
): Promise<{ slug: string; version: string; previous: string }> {
  return send(`/api/pages/${encodeURIComponent(slug)}/title`, "POST", { title });
}

export function restorePageVersion(
  slug: string,
  version: string,
): Promise<{ slug: string; version: string; restoredFrom: string }> {
  return send(`/api/pages/${encodeURIComponent(slug)}/restore`, "POST", { version });
}

// ── 만들기
//
// 서버는 `ie page create` / `ie flow create` 와 **같은 함수**를 부른다. 슬러그는 제목에서
// 만들어지고 충돌하면 뒤에 숫자가 붙으므로, 돌려받은 slug 로 이동해야 한다 — 보낸 제목으로
// 주소를 짐작하면 "대시보드"를 두 번 만들 때 첫 번째 것으로 간다.

export function createPage(title: string): Promise<{ slug: string; version: string; title: string }> {
  return send("/api/pages", "POST", { title });
}

export function createFlow(name: string): Promise<{ slug: string; name: string }> {
  return send("/api/flows", "POST", { name });
}

// ── 흐름 목록·설정

export interface FlowSummary {
  slug: string;
  name: string;
  screens: number;
  edges: number;
  updatedAt: string;
}

export function fetchFlows(): Promise<{ flows: FlowSummary[] }> {
  return get("/api/flows");
}

/**
 * 페이지를 화면으로 편입한다. `remove: true` 면 뺀다.
 *
 * 편입 시점의 페이지 버전이 박제되므로, 같은 페이지를 다시 편입하면 **최신본으로 다시 박제**된다.
 */
export function setFlowScreen(
  flowSlug: string,
  pageSlug: string,
  options?: { remove?: boolean },
): Promise<{ slug: string; screens: { slug: string; version: string }[] }> {
  return send(`/api/flows/${encodeURIComponent(flowSlug)}/screen`, "POST", {
    slug: pageSlug,
    ...(options?.remove ? { remove: true } : {}),
  });
}

export function setFlowSettings(
  slug: string,
  input: { start?: string; frame?: string },
): Promise<{ slug: string; start: string | null; frame: string | null }> {
  return send(`/api/flows/${encodeURIComponent(slug)}/settings`, "POST", input);
}

/** 이미 있는 연결의 목적지만 바꾼다 — 출발(핫스팟)은 화면 배선에서 만든다. */
export function retargetFlowEdge(
  slug: string,
  id: string,
  to: string,
): Promise<{ slug: string; edges: unknown[] }> {
  return send(`/api/flows/${encodeURIComponent(slug)}/edge`, "POST", { id, to });
}

/** 핫스팟(연결) 만들기. `remove: true` 면 그 자리의 연결을 지운다. */
export function linkFlowHotspot(
  slug: string,
  input: { fromSlug: string; nodeId: string; to?: string; action?: string; remove?: boolean },
): Promise<{ slug: string; edges: unknown[] }> {
  return send(`/api/flows/${encodeURIComponent(slug)}/link`, "POST", input);
}
