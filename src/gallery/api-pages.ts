import type { ResolvedConfig } from "../config/types.js";
import {
  appendFeedback,
  clearFeedback,
  readFeedback,
  removeFeedback,
  updateFeedback,
} from "../page/feedback.js";
import { isValidSlug } from "../page/slug.js";
import { json, readBody, type Req, type Res } from "./http.js";

/**
 * 피드백 API.
 *
 * `/api/pages/<slug>/feedback` — GET 목록 · POST 추가 · PATCH 수정 · DELETE 삭제/전체삭제.
 * 페이지 본문은 건드리지 않는다 — 리뷰 표면은 **지목만** 하고 배치는 에이전트가 한다.
 */
export function handlePageFeedback(
  req: Req,
  res: Res,
  path: string,
  config: ResolvedConfig,
  actor: string,
): boolean {
  const match = /^\/api\/pages\/([^/]+)\/feedback(?:\/([^/]+))?$/.exec(path);
  if (!match) return false;

  const slug = decodeURIComponent(match[1] ?? "");
  const itemId = match[2] ? decodeURIComponent(match[2]) : null;
  if (!isValidSlug(slug)) {
    json(res, { error: "invalid slug" }, 400);
    return true;
  }

  const method = req.method ?? "GET";

  if (method === "GET") {
    json(res, { slug, items: readFeedback(config.pagesDir, slug) });
    return true;
  }

  if (method === "POST") {
    void readBody(req)
      .then((raw) => {
        const input = raw as {
          comment?: unknown;
          nodeId?: unknown;
          nodeType?: unknown;
          components?: unknown;
        };
        const comment = typeof input.comment === "string" ? input.comment.trim() : "";
        if (!comment) return json(res, { error: "comment required" }, 400);

        const items = appendFeedback(config.pagesDir, slug, {
          comment,
          ...(typeof input.nodeId === "string" ? { nodeId: input.nodeId } : {}),
          ...(typeof input.nodeType === "string" ? { nodeType: input.nodeType } : {}),
          ...(Array.isArray(input.components)
            ? { components: input.components.filter((c): c is string => typeof c === "string") }
            : {}),
          actor,
        });
        json(res, { slug, items: items ?? [] }, 201);
      })
      .catch((err: unknown) => json(res, { error: String(err) }, 400));
    return true;
  }

  if (method === "PATCH" && itemId) {
    void readBody(req)
      .then((raw) => {
        const comment = (raw as { comment?: unknown }).comment;
        if (typeof comment !== "string" || !comment.trim()) {
          return json(res, { error: "comment required" }, 400);
        }
        json(res, { slug, items: updateFeedback(config.pagesDir, slug, itemId, comment.trim()) ?? [] });
      })
      .catch((err: unknown) => json(res, { error: String(err) }, 400));
    return true;
  }

  if (method === "DELETE") {
    // 항목 없이 부르면 전체 삭제 — 반영이 끝난 뒤 한 번에 비우는 동선.
    const items = itemId
      ? removeFeedback(config.pagesDir, slug, itemId)
      : clearFeedback(config.pagesDir, slug);
    json(res, { slug, items: items ?? [] });
    return true;
  }

  json(res, { error: "method not allowed" }, 405);
  return true;
}
