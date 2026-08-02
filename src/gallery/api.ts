import type { Connect, Plugin } from "vite";
import type { ResolvedConfig } from "../config/types.js";
import { listEntryNames, tryReadEntry } from "../registry/entry.js";
import { readHistory } from "../registry/history.js";
import { isValidName } from "../registry/paths.js";
import { listPages, readPageHistory, readSnapshot, tryReadPage } from "../page/store.js";
import { isValidSlug } from "../page/slug.js";
import { readFeedback } from "../page/feedback.js";
import { previewContentOf } from "../page/preview.js";
import { listFlows, tryReadFlow } from "../flow/store.js";
import { resolveActorName } from "../identity/store.js";
import { handlePageFeedback } from "./api-pages.js";
import { createAgentApi } from "./api-agent.js";
import { createIdentityApi } from "./api-identity.js";
import { json } from "./http.js";
import { packageVersion } from "../pkg.js";

/**
 * 갤러리 서버 API — 별도 프로세스가 아니라 Vite dev 서버의 미들웨어다.
 *
 * ── `/api/entry/<name>` 이 존재하는 이유
 * 갤러리는 SPA 라서 `/c/<없는이름>` 도 서버는 무조건 index.html + 200 을 돌려준다. "컴포넌트를
 * 찾을 수 없습니다"는 **브라우저에서만** 뜬다. 그래서 딥링크가 실제로 열리는지를 HTTP 로 확인할
 * 방법이 필요하다. 이 엔드포인트는 갤러리가 렌더에 쓰는 것과 **같은 레지스트리**를 읽으므로,
 * 200 이면 그 딥링크는 확실히 뜬다. 에이전트가 "확인됨"이라고 말해도 되는 유일한 근거다.
 */
export function ieApi(config: ResolvedConfig): Plugin {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };

  /*
   * 신원 API 는 항상 있다. 에이전트와 달리 위험한 일을 하지 않고, 없으면 첫 진입에서
   * 이름을 정할 길 자체가 사라진다.
   */
  const identityApi = createIdentityApi(config);

  /**
   * 에이전트 API 는 **켰을 때만 존재한다.** 꺼져 있으면 객체 자체를 만들지 않으므로
   * `/api/agent/*` 는 아래 최종 404 로 떨어진다 — "있는데 막혀 있다"가 아니라 "없다".
   */
  const agentApi = config.gallery.agent ? createAgentApi(config) : null;

  return {
    name: "instant-elements:api",
    configureServer(server) {
      if (agentApi) {
        // dev 서버가 내려갈 때 돌던 에이전트를 남기지 않는다.
        server.httpServer?.on("close", () => agentApi.dispose());
      }
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const path = url.split("?")[0] ?? "";

        /*
         * 신원만 `/api/` 밖의 경로도 받는다 — 로그인 콜백은 브라우저가 주소창으로 오는 전체
         * 페이지 이동이라 `/auth/callback` 이어야 한다(`/api/…` 로 두면 SPA 링크처럼 보인다).
         */
        if (identityApi.handle(req, res, path)) return;

        if (!url.startsWith("/api/")) return next();

        // 포트 점유자가 우리 갤러리인지 + 어느 프로젝트를 서빙 중인지 식별한다.
        // 여러 프로젝트를 오가며 작업할 때 "지금 뜬 갤러리가 내 프로젝트인가"를 확인하는 근거.
        if (path === "/api/health") {
          return json(res, {
            app: "instant-elements-gallery",
            version: packageVersion,
            root: config.root,
            registryDir: config.registryDir,
            title: config.gallery.title,
            // 이 갤러리가 에이전트를 띄울 수 있는 상태인지 — 프런트가 실행 UI 노출 여부를 이걸로 정한다.
            agent: config.gallery.agent,
          });
        }

        if (path === "/api/entries" && req.method === "GET") {
          const names = listEntryNames(dirs);
          return json(res, { count: names.length, names });
        }

        if (path.startsWith("/api/entry/") && req.method === "GET") {
          const name = decodeURIComponent(path.slice("/api/entry/".length));
          if (!isValidName(name)) return json(res, { error: "invalid name" }, 400);

          const entry = tryReadEntry(dirs, name);
          if (!entry) return json(res, { name, exists: false }, 404);
          return json(res, {
            name,
            exists: true,
            status: entry.meta.status,
            category: entry.meta.category,
            summary: entry.meta.summary,
          });
        }

        if (path.startsWith("/api/history/") && req.method === "GET") {
          const name = decodeURIComponent(path.slice("/api/history/".length));
          if (!isValidName(name)) return json(res, { error: "invalid name" }, 400);
          return json(res, { name, events: readHistory(dirs, name) });
        }

        // ── 페이지
        //
        // 가상 모듈이 아니라 API 로 제공한다. 페이지는 갤러리가 떠 있는 동안 CLI 가 계속 고치는
        // 데이터라, 모듈 무효화보다 필요할 때 다시 가져오는 편이 단순하고 어긋날 여지가 적다.
        if (path === "/api/pages" && req.method === "GET") {
          const pages = listPages(config.pagesDir).map((page) => ({
            slug: page.slug,
            title: page.title,
            version: page.version,
            updatedAt: page.updatedAt,
            updatedBy: page.updatedBy,
            nodes: page.data.content.length,
            // 목록에서 "어느 페이지인지" 알아보려면 제목만으로는 부족하다 — 얕은 구조를 함께 싣는다.
            preview: previewContentOf(page.data),
            // 미결 피드백이 몇 건인지가 목록에서 보여야 무엇부터 열지 정할 수 있다.
            feedback: readFeedback(config.pagesDir, page.slug).length,
          }));
          return json(res, { count: pages.length, pages });
        }

        if (agentApi?.handle(req, res, path)) return;

        /*
         * 피드백은 별도 모듈로 — /api/pages/<slug> 보다 먼저 잡아야 슬러그로 오인하지 않는다.
         *
         * actor 를 부팅 시 한 번이 아니라 **요청마다** 구한다. 사람이 갤러리에서 이름을 바꾸면
         * 그 다음 기록부터 바로 새 이름이어야 하는데, 부팅 값을 들고 있으면 서버를 다시 띄울
         * 때까지 옛 이름으로 남는다.
         */
        if (handlePageFeedback(req, res, path, config, resolveActorName(config.root))) return;

        if (path.startsWith("/api/pages/") && req.method === "GET") {
          const rest = path.slice("/api/pages/".length);
          const slug = decodeURIComponent(rest);
          if (!isValidSlug(slug)) return json(res, { error: "invalid slug" }, 400);

          const page = tryReadPage(config.pagesDir, slug);
          if (!page) return json(res, { slug, exists: false }, 404);
          return json(res, {
            slug,
            exists: true,
            version: page.version,
            title: page.title,
            updatedAt: page.updatedAt,
            updatedBy: page.updatedBy,
            data: page.data,
            history: readPageHistory(config.pagesDir, slug),
          });
        }

        // ── 흐름
        if (path === "/api/flows" && req.method === "GET") {
          const flows = listFlows(config.flowsDir).map((flow) => ({
            slug: flow.slug,
            name: flow.name,
            screens: flow.screens.length,
            edges: flow.edges.length,
            updatedAt: flow.updatedAt,
          }));
          return json(res, { count: flows.length, flows });
        }

        if (path.startsWith("/api/flows/") && req.method === "GET") {
          const slug = decodeURIComponent(path.slice("/api/flows/".length));
          if (!isValidSlug(slug)) return json(res, { error: "invalid slug" }, 400);
          const flow = tryReadFlow(config.flowsDir, slug);
          if (!flow) return json(res, { slug, exists: false }, 404);

          // 편입 시점에 박제한 스냅샷을 함께 싣는다 — 시연은 그 버전으로 돌아야 한다.
          const screens = flow.screens.map((screen) => {
            const snapshot = readSnapshot(config.pagesDir, screen.slug, screen.version);
            const live = snapshot ? null : tryReadPage(config.pagesDir, screen.slug);
            return {
              slug: screen.slug,
              version: screen.version,
              title: snapshot?.title ?? live?.title ?? screen.slug,
              data: snapshot?.data ?? live?.data ?? null,
              /** 스냅샷이 없어 최신본으로 대체했는가 — 시연이 흔들릴 수 있다는 신호. */
              stale: !snapshot,
            };
          });
          return json(res, { slug, exists: true, flow, screens });
        }

        return json(res, { error: "not found" }, 404);
      });
    },
  };
}
