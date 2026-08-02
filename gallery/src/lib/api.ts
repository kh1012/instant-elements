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

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${path} → HTTP ${response.status} ${detail}`);
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
