import type { Connect, Plugin } from "vite";
import type { ResolvedConfig } from "../config/types.js";
import { listEntryNames, tryReadEntry } from "../registry/entry.js";
import { readHistory } from "../registry/history.js";
import { isValidName } from "../registry/paths.js";
import { packageVersion } from "../pkg.js";

type Res = Parameters<Connect.NextHandleFunction>[1];

function json(res: Res, body: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

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

  return {
    name: "instant-elements:api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/")) return next();
        const path = url.split("?")[0] ?? "";

        // 포트 점유자가 우리 갤러리인지 + 어느 프로젝트를 서빙 중인지 식별한다.
        // 여러 프로젝트를 오가며 작업할 때 "지금 뜬 갤러리가 내 프로젝트인가"를 확인하는 근거.
        if (path === "/api/health") {
          return json(res, {
            app: "instant-elements-gallery",
            version: packageVersion,
            root: config.root,
            registryDir: config.registryDir,
            title: config.gallery.title,
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

        return json(res, { error: "not found" }, 404);
      });
    },
  };
}
