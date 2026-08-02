import type { ResolvedConfig } from "../config/types.js";
import { resolveActorName } from "../identity/store.js";
import { readEntry, writeEntry } from "../registry/entry.js";
import { appendHistory } from "../registry/history.js";
import { isValidName } from "../registry/paths.js";
import { isStatus } from "../registry/schema.js";
import { listRestorePoints, restoreElement } from "../restore/index.js";
import { isSameOrigin, json, readBody, type Req, type Res } from "./http.js";

/**
 * 컴포넌트를 **고치는** API — 상태 변경과 시점 복원.
 *
 * 둘 다 CLI 에만 있던 기능이다(`ie element status`, `ie element restore`). 화면에서 상태를
 * 보면서 바꾸지 못하고, 히스토리에 SHA 가 남아 있는데 그걸로 되돌릴 손잡이가 없었다 —
 * 기록의 가치는 되돌릴 수 있을 때 생긴다.
 *
 * 구현은 새로 쓰지 않고 CLI 와 **같은 함수**를 부른다. 갈라지면 화면으로 바꾼 상태와 CLI 로
 * 바꾼 상태가 다른 기록을 남긴다.
 */
export function createEntryApi(config: ResolvedConfig, isRunning: (name: string) => boolean) {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };

  return {
    handle(req: Req, res: Res, path: string): boolean {
      const restorePoints = /^\/api\/entry\/([^/]+)\/restore-points$/.exec(path);
      if (restorePoints && req.method === "GET") {
        const name = decodeURIComponent(restorePoints[1] ?? "");
        if (!isValidName(name)) return json(res, { error: "invalid name" }, 400), true;
        return json(res, { name, points: listRestorePoints(config, name) }), true;
      }

      const status = /^\/api\/entry\/([^/]+)\/status$/.exec(path);
      const restore = /^\/api\/entry\/([^/]+)\/restore$/.exec(path);
      if (!status && !restore) return false;
      if (req.method !== "POST") return false;

      if (!isSameOrigin(req)) {
        json(res, { error: "cross-origin 요청은 거부합니다." }, 403);
        return true;
      }

      const name = decodeURIComponent((status ?? restore)?.[1] ?? "");
      if (!isValidName(name)) {
        json(res, { error: "invalid name" }, 400);
        return true;
      }

      /*
       * 에이전트가 이 컴포넌트를 고치고 있는 중이면 막는다.
       *
       * 화면에서도 비활성으로 보여 주지만 여기서 **한 번 더** 막는다 — 버튼을 누른 뒤 실행이
       * 시작되는 경합이 있고, 그 사이에 파일을 되돌리면 에이전트가 반쯤 쓴 상태 위에 덮어쓴다.
       */
      if (isRunning(name)) {
        json(res, { error: `${name} 을 지금 에이전트가 고치고 있습니다. 끝난 뒤에 해 주세요.` }, 409);
        return true;
      }

      void readBody(req)
        .then((body) => {
          if (status) {
            const next = (body as { status?: unknown }).status;
            if (!isStatus(next)) {
              return json(res, { error: "status 는 draft|stable|deprecated 중 하나여야 합니다." }, 400);
            }

            const entry = readEntry(dirs, name);
            const previous = entry.meta.status;
            if (previous === next) return json(res, { name, status: next, changed: false });

            entry.meta.status = next;
            writeEntry(dirs, entry);
            appendHistory(dirs, name, {
              at: new Date().toISOString(),
              actor: resolveActorName(config.root),
              action: "modified",
              note: `상태 변경: ${previous} → ${next}`,
            });
            return json(res, { name, status: next, changed: true });
          }

          const sha = (body as { sha?: unknown }).sha;
          if (typeof sha !== "string") return json(res, { error: "sha 가 필요합니다." }, 400);

          const result = restoreElement(config, name, sha, resolveActorName(config.root));
          return json(res, result);
        })
        .catch((err: unknown) => {
          // CliError 는 사람이 읽을 hint 를 갖고 있다 — 화면에 그대로 보여 주면 다음 행동이 정해진다.
          const message = err instanceof Error ? err.message : String(err);
          const hint = (err as { hint?: string }).hint;
          json(res, { error: hint ? `${message} — ${hint}` : message }, 400);
        });

      return true;
    },
  };
}
