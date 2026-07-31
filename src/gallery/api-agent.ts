import type { Connect } from "vite";
import { AgentRunStore } from "../agent/run-store.js";
import type { AgentEvent } from "../agent/types.js";
import type { ResolvedConfig } from "../config/types.js";

type Req = Parameters<Connect.NextHandleFunction>[0];
type Res = Parameters<Connect.NextHandleFunction>[1];

function json(res: Res, body: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: Req, limit = 512_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer | string) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("payload too large"));
        req.destroy();
      }
    });
    req.on("error", reject);
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * 다른 사이트가 이 API 를 부르지 못하게 막는다.
 *
 * 이 서버는 localhost 에 열려 있고 **파일을 고칠 수 있는 프로세스를 띄운다.** 브라우저는
 * 다른 탭의 악성 페이지가 보낸 요청도 그대로 전달하므로(CSRF), 요청이 우리 갤러리에서
 * 온 것인지 확인해야 한다.
 *
 * - `sec-fetch-site: same-origin` — 최신 브라우저가 붙여 주는 표시. 위조할 수 없다.
 * - `origin` 허용목록 — 헤더가 없는 클라이언트(curl 등)를 위한 이중 확인. 상류처럼 포트를
 *   하드코딩하지 않고 설정에서 계산한다(소비자마다 포트가 다르다).
 */
function isSameOrigin(req: Req, config: ResolvedConfig): boolean {
  const site = req.headers["sec-fetch-site"];
  if (typeof site === "string" && site !== "same-origin") return false;

  const origin = req.headers["origin"];
  if (typeof origin !== "string") return true; // 브라우저가 아닌 클라이언트 — sec-fetch-site 로 이미 걸렀다.

  const { host, port } = config.gallery;
  const allowed = new Set([`http://${host}:${port}`, `http://localhost:${port}`, `http://127.0.0.1:${port}`]);
  return allowed.has(origin);
}

/**
 * 에이전트 실행 API — **`gallery.agent` 가 켜졌을 때만 등록된다**(src/gallery/api.ts).
 *
 * `/api/agent/runs`        GET   현재 실행 목록
 * `/api/agent/run`         POST  새 실행 시작
 * `/api/agent/kill/<id>`   POST  중단
 * `/api/agent/stream`      GET   SSE — 모든 실행의 이벤트를 한 채널로 흘린다
 *
 * SSE 를 실행마다 열지 않고 하나로 합치는 이유: 브라우저의 동시 연결 수는 제한돼 있고,
 * 화면은 어차피 "지금 무슨 일이 일어나는가"를 한곳에서 보여 준다. 실행 id 는 payload 에 담는다.
 */
export function createAgentApi(config: ResolvedConfig): {
  handle(req: Req, res: Res, path: string): boolean;
  dispose(): void;
} {
  const store = new AgentRunStore(config.root);

  return {
    dispose(): void {
      store.killAll();
    },

    handle(req: Req, res: Res, path: string): boolean {
      if (!path.startsWith("/api/agent/")) return false;

      const method = req.method ?? "GET";

      // ── SSE: 모든 실행의 이벤트 한 채널
      if (path === "/api/agent/stream" && method === "GET") {
        res.statusCode = 200;
        res.setHeader("content-type", "text/event-stream; charset=utf-8");
        res.setHeader("cache-control", "no-cache, no-transform");
        res.setHeader("connection", "keep-alive");

        const send = (payload: unknown): void => {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };

        // 재연결한 클라이언트가 놓친 이력을 복구할 수 있게 현재 상태를 통째로 먼저 보낸다.
        send({ type: "snapshot", runs: store.list() });

        const unsubscribe = store.subscribe((runId: string, event: AgentEvent) => {
          send({ type: "event", runId, event, run: store.get(runId) });
        });

        // 프록시·브라우저가 조용한 연결을 끊지 않게 주기적으로 주석 프레임을 보낸다.
        const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);
        heartbeat.unref?.();

        req.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return true;
      }

      // 여기부터는 상태를 바꾸는 요청 — 반드시 우리 갤러리에서 온 것이어야 한다.
      if (method === "POST" && !isSameOrigin(req, config)) {
        json(res, { error: "cross-origin 요청은 거부합니다." }, 403);
        return true;
      }

      if (path === "/api/agent/runs" && method === "GET") {
        json(res, { runs: store.list() });
        return true;
      }

      if (path === "/api/agent/run" && method === "POST") {
        void readBody(req)
          .then((raw) => {
            const input = raw as { label?: unknown; prompt?: unknown; contextHref?: unknown };
            const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
            if (!prompt) return json(res, { error: "prompt required" }, 400);

            const result = store.start({
              label: typeof input.label === "string" && input.label ? input.label : "실행",
              prompt,
              contextHref: typeof input.contextHref === "string" ? input.contextHref : "",
            });
            if (!result.ok) return json(res, { error: result.reason }, 409);
            json(res, { run: result.run }, 201);
          })
          .catch((err: unknown) => json(res, { error: String(err) }, 400));
        return true;
      }

      const killMatch = /^\/api\/agent\/kill\/([^/]+)$/.exec(path);
      if (killMatch && method === "POST") {
        const runId = decodeURIComponent(killMatch[1] ?? "");
        const killed = store.kill(runId);
        json(res, { runId, killed }, killed ? 200 : 404);
        return true;
      }

      json(res, { error: "not found" }, 404);
      return true;
    },
  };
}
