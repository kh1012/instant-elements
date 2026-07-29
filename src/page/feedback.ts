import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readJsonClassified, writeJsonAtomic } from "../registry/io.js";
import { withFileLock } from "./lock.js";
import { fileIn } from "./slug.js";

/**
 * 페이지 리뷰 피드백 — `pages/<slug>.feedback.json`.
 *
 * 페이지 본문(`<slug>.json`)과 **별개 파일**이다. 그 파일은 `/page-create` 스킬과 공유하는
 * 계약이라, 리뷰 코멘트를 그 안에 섞으면 리파인 때 조용히 밟히거나 스킬에게 새 규칙을
 * 가르쳐야 한다. 페이지를 과거 버전으로 되돌릴 때 리뷰까지 함께 되돌아가서도 안 된다.
 *
 * `nodeId` 가 없으면 특정 요소가 아니라 **페이지 전체**에 대한 코멘트다.
 */
export interface FeedbackItem {
  id: string;
  /** 지목한 노드의 `props.id`. 없으면 전체 레이아웃에 대한 의견. */
  nodeId?: string;
  nodeType?: string;
  comment: string;
  /**
   * 이 자리에 놓아 달라고 지목한 레지스트리 컴포넌트 이름들.
   * 실제 배치는 여기서 하지 않는다 — 리뷰 표면은 **지목만** 하고, 배치는 프롬프트를 받은
   * 에이전트가 수행한다. 그래야 리뷰가 편집기를 배우지 않아도 성립한다.
   */
  components?: string[];
  at: string;
  actor: string;
}

function feedbackPath(pagesDir: string, slug: string): string | null {
  return fileIn(pagesDir, slug, ".feedback.json");
}

export function readFeedback(pagesDir: string, slug: string): FeedbackItem[] {
  const path = feedbackPath(pagesDir, slug);
  if (!path || !existsSync(path)) return [];
  const result = readJsonClassified<{ items?: FeedbackItem[] }>(path);
  if (result.status !== "ok") return [];
  return Array.isArray(result.value.items) ? result.value.items : [];
}

export interface AppendFeedbackInput {
  nodeId?: string;
  nodeType?: string;
  comment: string;
  components?: string[];
  actor: string;
}

export function appendFeedback(
  pagesDir: string,
  slug: string,
  input: AppendFeedbackInput,
): FeedbackItem[] | null {
  const path = feedbackPath(pagesDir, slug);
  if (!path) return null;
  return withFileLock(path, () => {
    const items = readFeedback(pagesDir, slug);
    items.push({
      id: randomUUID(),
      ...(input.nodeId ? { nodeId: input.nodeId } : {}),
      ...(input.nodeType ? { nodeType: input.nodeType } : {}),
      comment: input.comment,
      ...(input.components?.length ? { components: input.components } : {}),
      at: new Date().toISOString(),
      actor: input.actor,
    });
    writeJsonAtomic(path, { items });
    return items;
  });
}

/** 본문만 고친다 — 대상 노드·지목 컴포넌트·작성자는 그대로 둔다(수정은 "무슨 말을 했나"의 정정이다). */
export function updateFeedback(
  pagesDir: string,
  slug: string,
  id: string,
  comment: string,
): FeedbackItem[] | null {
  const path = feedbackPath(pagesDir, slug);
  if (!path) return null;
  return withFileLock(path, () => {
    const items = readFeedback(pagesDir, slug).map((item) =>
      item.id === id ? { ...item, comment } : item,
    );
    writeJsonAtomic(path, { items });
    return items;
  });
}

export function removeFeedback(
  pagesDir: string,
  slug: string,
  id: string,
): FeedbackItem[] | null {
  const path = feedbackPath(pagesDir, slug);
  if (!path) return null;
  return withFileLock(path, () => {
    const items = readFeedback(pagesDir, slug).filter((item) => item.id !== id);
    writeJsonAtomic(path, { items });
    return items;
  });
}

/** 반영이 끝났을 때 한 번에 비운다. */
export function clearFeedback(pagesDir: string, slug: string): FeedbackItem[] | null {
  const path = feedbackPath(pagesDir, slug);
  if (!path) return null;
  return withFileLock(path, () => {
    writeJsonAtomic(path, { items: [] });
    return [];
  });
}
