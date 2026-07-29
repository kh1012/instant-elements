import type { PageData, PageHistoryEvent } from "instant-elements/page";

/**
 * 갤러리 서버 API 클라이언트.
 *
 * 페이지는 갤러리가 떠 있는 동안 CLI 가 계속 고치는 데이터라, 빌드 타임에 굳히지 않고
 * 필요할 때 가져온다.
 */

export interface PageSummary {
  slug: string;
  title: string;
  version: string;
  updatedAt: string;
  updatedBy: string;
  nodes: number;
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
