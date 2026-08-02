import { AgentRunStore } from "../agent/run-store.js";
import type { AgentEvent } from "../agent/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { isSameOrigin, json, readBody, type Req, type Res } from "./http.js";

/**
 * 에이전트 실행 API — **`gallery.agent` 가 켜졌을 때만 등록된다**(src/gallery/api.ts).
 *
 * `/api/agent/runs`          GET   현재 실행 목록
 * `/api/agent/run`           POST  새 실행 시작
 * `/api/agent/continue/<id>` POST  끝난 실행에 턴 이어붙이기
 * `/api/agent/kill/<id>`     POST  중단
 * `/api/agent/stream`        GET   SSE — 모든 실행의 이벤트를 한 채널로 흘린다
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
      if (method === "POST" && !isSameOrigin(req)) {
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

      const continueMatch = /^\/api\/agent\/continue\/([^/]+)$/.exec(path);
      if (continueMatch && method === "POST") {
        const runId = decodeURIComponent(continueMatch[1] ?? "");
        void readBody(req)
          .then((raw) => {
            const prompt = (raw as { prompt?: unknown }).prompt;
            const text = typeof prompt === "string" ? prompt.trim() : "";
            if (!text) return json(res, { error: "prompt required" }, 400);
            const result = store.continueRun(runId, text);
            if (!result.ok) return json(res, { error: result.reason }, 409);
            json(res, { run: result.run });
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
