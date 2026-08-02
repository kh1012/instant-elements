import type { ResolvedConfig } from "../config/types.js";
import { FRAMES } from "../page/schema.js";
import { readFlow, writeFlow } from "../flow/store.js";
import { isValidSlug } from "../page/slug.js";
import { isSameOrigin, json, readBody, type Req, type Res } from "./http.js";

/**
 * 흐름을 **고치는** API.
 *
 * `POST /api/flows/<slug>/settings` — 시작 화면·프레임.
 * `POST /api/flows/<slug>/edge` — 이미 있는 연결의 **목적지 변경**.
 * `POST /api/flows/<slug>/link` — 새 핫스팟(연결) 만들기·지우기.
 *
 * 지금까지 흐름은 CLI 로만 고칠 수 있었다. 시연 직전에 "시작을 이 화면으로 바꿔줘"가 나오면
 * 터미널로 나가야 했는데, 그건 시연 준비 중에 가장 하기 싫은 일이다.
 *
 * 쓰기는 전부 `writeFlow` 를 통과한다 — 파일 락과 `updatedAt`/`updatedBy` 갱신이 거기 있다.
 * 우회하면 CLI 와 화면이 동시에 만질 때 한쪽이 사라진다.
 */
export function createFlowEditApi(config: ResolvedConfig) {
  const store = (actor: string) => ({ flowsDir: config.flowsDir, actor });

  return {
    handle(req: Req, res: Res, path: string, actor: string): boolean {
      const settings = /^\/api\/flows\/([^/]+)\/settings$/.exec(path);
      const edge = /^\/api\/flows\/([^/]+)\/edge$/.exec(path);
      const link = /^\/api\/flows\/([^/]+)\/link$/.exec(path);
      if (!settings && !edge && !link) return false;
      if (req.method !== "POST") return false;

      if (!isSameOrigin(req)) {
        json(res, { error: "cross-origin 요청은 거부합니다." }, 403);
        return true;
      }

      const slug = decodeURIComponent((settings ?? edge ?? link)?.[1] ?? "");
      if (!isValidSlug(slug)) {
        json(res, { error: "invalid slug" }, 400);
        return true;
      }

      void readBody(req)
        .then((body) => {
          const current = readFlow(config.flowsDir, slug);

          if (link) {
            /*
             * 핫스팟 하나 = 연결 하나. id 를 CLI(`ie flow link`)와 **같은 규칙**으로 만든다 —
             * 다르게 만들면 같은 자리에 두 연결이 생겨 시연에서 어느 쪽이 이기는지 알 수 없다.
             */
            const input = body as {
              fromSlug?: unknown;
              nodeId?: unknown;
              to?: unknown;
              action?: unknown;
              value?: unknown;
              remove?: unknown;
            };
            if (typeof input.fromSlug !== "string" || typeof input.nodeId !== "string") {
              return json(res, { error: "fromSlug 와 nodeId 가 필요합니다." }, 400);
            }
            if (!current.screens.some((s) => s.slug === input.fromSlug)) {
              return json(res, { error: `편입되지 않은 화면입니다: ${input.fromSlug}` }, 400);
            }

            const action = typeof input.action === "string" && input.action ? input.action : undefined;
            const value = typeof input.value === "string" && input.value ? input.value : undefined;
            const id = `${input.fromSlug}:${input.nodeId}${action ? `:${action}` : ""}${value ? `=${value}` : ""}→${input.to ?? ""}`;

            if (input.remove === true) {
              const flow = writeFlow(store(actor), slug, (existing) => ({
                ...existing,
                edges: existing.edges.filter(
                  (e) => !(e.from.slug === input.fromSlug && e.from.nodeId === input.nodeId),
                ),
              }));
              return json(res, { slug, edges: flow.edges });
            }

            if (typeof input.to !== "string") {
              return json(res, { error: "to 가 필요합니다." }, 400);
            }
            if (!current.screens.some((s) => s.slug === input.to)) {
              return json(res, { error: `편입되지 않은 화면입니다: ${input.to}` }, 400);
            }

            const flow = writeFlow(store(actor), slug, (existing) => ({
              ...existing,
              // 같은 자리에 이미 있으면 갈아끼운다 — 한 노드가 두 곳으로 가면 시연이 흔들린다.
              edges: [
                ...existing.edges.filter(
                  (e) => !(e.from.slug === input.fromSlug && e.from.nodeId === input.nodeId),
                ),
                {
                  id,
                  from: {
                    slug: input.fromSlug as string,
                    nodeId: input.nodeId as string,
                    ...(action ? { action } : {}),
                    ...(value ? { value } : {}),
                  },
                  to: input.to as string,
                },
              ],
            }));
            return json(res, { slug, edges: flow.edges });
          }

          if (edge) {
            /*
             * 드래그로 바꾸는 것은 **목적지뿐**이다. 출발(어느 화면의 어느 노드·어느 액션)은
             * 썸네일에서 고를 수 없다 — 카드 안에서 어느 요소가 어느 자리인지 분간이 안 된다.
             * 핫스팟을 새로 만드는 일은 화면 배선 라우트가 맡는다.
             */
            const input = body as { id?: unknown; to?: unknown };
            if (typeof input.id !== "string" || typeof input.to !== "string") {
              return json(res, { error: "id 와 to 가 필요합니다." }, 400);
            }
            if (!current.edges.some((e) => e.id === input.id)) {
              return json(res, { error: `없는 연결입니다: ${input.id}` }, 404);
            }
            if (!current.screens.some((s) => s.slug === input.to)) {
              return json(res, { error: `편입되지 않은 화면입니다: ${input.to}` }, 400);
            }

            const flow = writeFlow(store(actor), slug, (existing) => ({
              ...existing,
              edges: existing.edges.map((e) =>
                e.id === input.id ? { ...e, to: input.to as string } : e,
              ),
            }));
            return json(res, { slug, edges: flow.edges });
          }

          const input = body as { start?: unknown; frame?: unknown };

          /*
           * 시작 화면은 **편입된 화면 중 하나**여야 한다. 아무 slug 나 받으면 시연이 빈 화면에서
           * 시작하고, 그 사실은 재생을 눌러 봐야 안다.
           */
          if (input.start !== undefined) {
            if (typeof input.start !== "string") {
              return json(res, { error: "start 는 문자열이어야 합니다." }, 400);
            }
            if (!current.screens.some((screen) => screen.slug === input.start)) {
              return json(
                res,
                { error: `편입되지 않은 화면입니다: ${input.start}` },
                400,
              );
            }
          }

          // 프레임은 아는 값만. 빈 문자열은 "페이지가 정한 값을 따른다"는 뜻으로 해제한다.
          if (input.frame !== undefined && input.frame !== "") {
            if (typeof input.frame !== "string" || !(input.frame in FRAMES)) {
              return json(
                res,
                { error: `알 수 없는 프레임입니다: ${String(input.frame)}` },
                400,
              );
            }
          }

          const flow = writeFlow(store(actor), slug, (existing) => {
            const next = { ...existing };
            if (input.start !== undefined) next.start = input.start as string;
            if (input.frame !== undefined) {
              if (input.frame === "") delete next.frame;
              else next.frame = input.frame as string;
            }
            return next;
          });

          return json(res, { slug, start: flow.start ?? null, frame: flow.frame ?? null });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          const hint = (err as { hint?: string }).hint;
          json(res, { error: hint ? `${message} — ${hint}` : message }, 400);
        });

      return true;
    },
  };
}
