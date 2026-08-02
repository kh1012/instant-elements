import type { ResolvedConfig } from "../config/types.js";
import { resolveActorName } from "../identity/store.js";
import {
  listSnapshots,
  readPage,
  readSnapshot,
  savePage,
  tryReadPage,
} from "../page/store.js";
import { isValidSlug } from "../page/slug.js";
import { isSameOrigin, json, readBody, type Req, type Res } from "./http.js";

/**
 * 페이지를 **고치는** API — 제목 수정과 버전 복원.
 *
 * 둘 다 `savePage` 를 통과한다. 파일을 직접 쓰지 않는 이유는 그 함수가 **낙관적 동시성**을
 * 들고 있기 때문이다 — 읽기와 쓰기 사이에 에이전트가 저장했으면 거부한다. 우회해서 쓰면
 * 리뷰어가 제목을 고치는 사이 에이전트가 조립한 내용이 통째로 사라진다.
 *
 * ── 복원이 왜 "되돌리기"가 아니라 "새 버전"인가
 * 스냅샷의 내용을 **새 버전으로 다시 저장한다**(v1.0.5 → v1.0.6, 내용은 v1.0.2 의 것).
 * 버전을 v1.0.2 로 되감으면 그 사이의 스냅샷들이 덮어써지고, 되돌린 것을 다시 되돌릴 수 없다.
 * 앞으로만 가는 기록이 되돌리기를 안전하게 만든다.
 */
export function createPageEditApi(config: ResolvedConfig) {
  const store = () => ({ pagesDir: config.pagesDir, actor: resolveActorName(config.root) });

  return {
    handle(req: Req, res: Res, path: string): boolean {
      const versions = /^\/api\/pages\/([^/]+)\/versions$/.exec(path);
      if (versions && req.method === "GET") {
        const slug = decodeURIComponent(versions[1] ?? "");
        if (!isValidSlug(slug)) return json(res, { error: "invalid slug" }, 400), true;
        const page = tryReadPage(config.pagesDir, slug);
        if (!page) return json(res, { slug, exists: false }, 404), true;

        /*
         * 최신순으로 준다 — 되돌릴 대상은 대개 **방금 것 바로 앞**이라, 오래된 것부터 세우면
         * 목록 끝까지 내려가야 한다. `listSnapshots` 가 이미 내림차순이므로 뒤집지 않는다.
         * 지금 버전은 복원 대상에서 뺀다(자기 자신으로 되돌릴 이유가 없다).
         */
        const list = listSnapshots(config.pagesDir, slug)
          .filter((version) => version !== page.version)
          .map((version) => {
            const snapshot = readSnapshot(config.pagesDir, slug, version);
            return {
              version,
              title: snapshot?.title ?? slug,
              updatedAt: snapshot?.updatedAt ?? "",
              updatedBy: snapshot?.updatedBy ?? "",
              /** 그 버전이 담고 있던 최상위 노드 수 — 무엇이 달라지는지 가늠할 유일한 단서. */
              nodes: snapshot?.data.content.length ?? 0,
            };
          });

        return json(res, { slug, current: page.version, versions: list }), true;
      }

      const title = /^\/api\/pages\/([^/]+)\/title$/.exec(path);
      const restore = /^\/api\/pages\/([^/]+)\/restore$/.exec(path);
      if (!title && !restore) return false;
      if (req.method !== "POST") return false;

      if (!isSameOrigin(req)) {
        json(res, { error: "cross-origin 요청은 거부합니다." }, 403);
        return true;
      }

      const slug = decodeURIComponent((title ?? restore)?.[1] ?? "");
      if (!isValidSlug(slug)) {
        json(res, { error: "invalid slug" }, 400);
        return true;
      }

      void readBody(req)
        .then((body) => {
          const current = readPage(config.pagesDir, slug);

          if (title) {
            const next = (body as { title?: unknown }).title;
            if (typeof next !== "string" || !next.trim()) {
              return json(res, { error: "title 이 비어 있습니다." }, 400);
            }
            // 제목만 바꾼다 — 본문(data)은 지금 것을 그대로 다시 쓴다.
            const result = savePage(store(), {
              slug,
              base: current.version,
              data: current.data,
              title: next.trim(),
              action: "edited",
              note: `제목 변경: ${current.title} → ${next.trim()}`,
            });
            return json(res, result);
          }

          const version = (body as { version?: unknown }).version;
          if (typeof version !== "string") {
            return json(res, { error: "version 이 필요합니다." }, 400);
          }

          const snapshot = readSnapshot(config.pagesDir, slug, version);
          if (!snapshot) {
            return json(res, { error: `그 버전의 스냅샷이 없습니다: ${version}` }, 404);
          }

          const result = savePage(store(), {
            slug,
            base: current.version,
            data: snapshot.data,
            title: snapshot.title,
            action: "restored",
            note: `${version} 내용으로 복원`,
          });
          return json(res, { ...result, restoredFrom: version });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          const hint = (err as { hint?: string }).hint;
          // 동시성 충돌은 409 로 — 화면이 "다시 읽고 해 보세요"라고 말할 수 있어야 한다.
          const status = (err as { name?: string }).name === "PageConflictError" ? 409 : 400;
          json(res, { error: hint ? `${message} — ${hint}` : message }, status);
        });

      return true;
    },
  };
}
