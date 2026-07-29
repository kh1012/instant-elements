import type { PageData, PageNode } from "./schema.js";

/**
 * 목록 썸네일용 얕은 구조.
 *
 * 페이지 목록에서 제목만 보여 주면 "어느 페이지인지" 알아보기가 어렵다 — 사람은 제목보다
 * **모양**으로 기억한다. 그렇다고 전문을 실으면 응답이 수천 줄이 되므로, 썸네일이 그릴 만큼만
 * 얕게 자른다.
 */
export interface PreviewNode {
  type: string;
  id?: string;
  cols?: number;
  items?: PreviewNode[];
}

const MAX_DEPTH = 4;
const MAX_TOP = 12;
const MAX_CHILDREN = 10;

function nodeOf(node: PageNode, depth: number): PreviewNode | null {
  if (!node || typeof node.type !== "string" || depth > MAX_DEPTH) return null;
  const out: PreviewNode = { type: node.type };
  if (typeof node.props?.id === "string") out.id = node.props.id;
  if (typeof node.props?.cols === "number") out.cols = node.props.cols;

  const items = node.props?.items;
  if (Array.isArray(items)) {
    const children = items
      .slice(0, MAX_CHILDREN)
      .map((child) => nodeOf(child as PageNode, depth + 1))
      .filter((child): child is PreviewNode => child !== null);
    if (children.length > 0) out.items = children;
  }
  return out;
}

export function previewContentOf(data: PageData): PreviewNode[] {
  if (!Array.isArray(data?.content)) return [];
  return data.content
    .slice(0, MAX_TOP)
    .map((node) => nodeOf(node, 0))
    .filter((node): node is PreviewNode => node !== null);
}
