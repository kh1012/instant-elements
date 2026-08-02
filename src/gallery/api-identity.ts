import { randomBytes } from "node:crypto";
import type { ResolvedConfig } from "../config/types.js";
import { readGitInfo } from "../cli/project.js";
import { clearIdentity, readIdentity, writeIdentity, type Identity } from "../identity/store.js";
import { isSameOrigin, json, readBody, type Req, type Res } from "./http.js";

/** 연결 대기의 수명. 브라우저에서 로그인 한 번 하기에 넉넉하고, 잊힌 채 남아 있기엔 짧다. */
const STATE_TTL_MS = 10 * 60 * 1000;
/** 동시에 열어 둘 수 있는 연결 시도. 실수로 여러 번 눌러도 되게 하되 무한히 쌓이지는 않게. */
const MAX_PENDING = 8;

const NICKNAME_MAX = 60;
/** GitHub 로그인 규칙 — 영숫자와 하이픈, 하이픈으로 시작·끝나지 않음, 39자 이하. */
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/**
 * 표시 이름 정리.
 *
 * 제어문자를 지우는 게 핵심이다 — 개행이 섞인 이름은 히스토리 JSONL 한 줄을 두 줄로 쪼개고,
 * 그 줄부터 파일 전체가 읽히지 않는다.
 */
function cleanNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // 제어문자를 공백으로 — 개행 하나가 히스토리 JSONL 한 줄을 두 줄로 쪼갠다.
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, NICKNAME_MAX);
  return cleaned || null;
}

/** 아바타는 https 만 받는다. http 를 섞으면 갤러리 페이지에 혼합 콘텐츠 경고가 뜬다. */
function cleanAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 500) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

interface Pending {
  expiresAt: number;
}

/**
 * 신원 API.
 *
 * ── 로그인은 왜 마켓플레이스를 경유하나
 * 갤러리에 `@supabase/supabase-js` 를 넣지 않기 위해서다(갤러리는 런타임 서드파티 의존성이 0인
 * 것이 원칙이다). 대신 브라우저를 마켓플레이스 `/link` 로 보내고, 거기서 로그인이 끝나면
 * 우리 콜백으로 **신원만** 돌려받는다.
 *
 * ── 왜 서명이 없나
 * 여기로 돌아오는 값은 **이름표이지 열쇠가 아니다.** 위조해 봐야 이 컴퓨터의 히스토리에 찍히는
 * 표시 이름이 바뀔 뿐이고, 실제 권한(잔액 차감·발행)은 전부 마켓플레이스 세션에 남는다.
 * 그래서 HMAC·TTL 저장소 대신, 우리가 발급한 `state` 대조만 한다 — 이건 서명이 아니라 지나가던
 * 페이지가 콜백을 때리는 것(드라이브바이)을 막는 장치다.
 */
export function createIdentityApi(config: ResolvedConfig) {
  const pending = new Map<string, Pending>();

  const sweep = () => {
    const now = Date.now();
    for (const [key, value] of pending) {
      if (value.expiresAt <= now) pending.delete(key);
    }
  };

  const redirect = (res: Res, to: string): void => {
    res.statusCode = 302;
    res.setHeader("location", to);
    res.end();
  };

  return {
    handle(req: Req, res: Res, path: string): boolean {
      // ── 로그인 콜백. 브라우저가 주소창으로 오는 **전체 페이지 이동**이라 /api/ 아래가 아니다.
      if (path === "/auth/callback") {
        const url = new URL(req.url ?? "/", "http://localhost");
        const state = url.searchParams.get("state") ?? "";

        sweep();
        // 한 번 쓰면 버린다 — 같은 링크를 다시 열어 신원이 되살아나는 일이 없게.
        const ok = pending.delete(state);
        if (!ok) return redirect(res, "/?linked=denied"), true;

        const nickname = cleanNickname(url.searchParams.get("name") ?? url.searchParams.get("login"));
        const login = url.searchParams.get("login") ?? "";
        const provider = url.searchParams.get("provider");
        if (!nickname || !LOGIN_RE.test(login) || (provider !== "github" && provider !== "google")) {
          return redirect(res, "/?linked=invalid"), true;
        }

        const identity: Identity = { nickname, provider, login };
        const avatarUrl = cleanAvatarUrl(url.searchParams.get("avatar"));
        if (avatarUrl) identity.avatarUrl = avatarUrl;
        writeIdentity(identity);

        return redirect(res, "/?linked=1"), true;
      }

      if (path !== "/api/identity" && !path.startsWith("/api/identity/")) return false;

      if (path === "/api/identity" && req.method === "GET") {
        // git 이름도 함께 준다 — 팝오버에서 "닉네임을 쓰는 중" 인지 "git 설정으로 대체 중" 인지
        // 보여 주려면 둘 다 필요하다.
        json(res, { identity: readIdentity(), gitUserName: readGitInfo(config.root).userName });
        return true;
      }

      // 여기서부터는 쓰기다. 다른 탭의 페이지가 내 이름을 바꾸지 못하게 막는다.
      if (!isSameOrigin(req)) {
        json(res, { error: "cross-origin 요청은 거부합니다." }, 403);
        return true;
      }

      if (path === "/api/identity" && req.method === "POST") {
        void readBody(req)
          .then((body) => {
            const nickname = cleanNickname((body as { nickname?: unknown }).nickname);
            if (!nickname) return json(res, { error: "이름이 비어 있습니다." }, 400);

            /*
             * 기존 신원 위에 이름만 덮는다. GitHub 로 연결한 사람이 표시 이름만 바꾸고 싶을 때
             * 연결까지 끊기면 안 된다. 연결 해제는 DELETE 로 명시적으로 한다.
             */
            const current = readIdentity();
            const next: Identity = current
              ? { ...current, nickname }
              : { nickname, provider: "local" };
            writeIdentity(next);
            json(res, { identity: next });
          })
          .catch((err: unknown) => json(res, { error: String(err) }, 400));
        return true;
      }

      if (path === "/api/identity" && req.method === "DELETE") {
        clearIdentity();
        json(res, { identity: null });
        return true;
      }

      // ── 연결 시작. state 를 발급하고 마켓플레이스로 보낼 주소를 만들어 준다.
      if (path === "/api/identity/link" && req.method === "POST") {
        /*
         * 돌아올 포트는 **설정이 아니라 실제로 듣고 있는 포트**여야 한다. `ie gallery --port` 로
         * 띄우면 config 값과 달라지고, 그러면 콜백이 아무도 없는 포트로 간다. 요청의 Host 를
         * 쓰되 우리가 아는 호스트인지 확인한다.
         */
        const host = req.headers.host ?? "";
        const port = /^(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)$/.exec(host)?.[1];
        if (!port) {
          json(res, { error: `로컬 호스트가 아닌 곳에서는 연결할 수 없습니다: ${host}` }, 400);
          return true;
        }

        void readBody(req)
          .then((body) => {
            sweep();
            if (pending.size >= MAX_PENDING) {
              // 가장 오래된 것부터 버린다(Map 은 삽입 순서를 지킨다).
              const oldest = pending.keys().next().value;
              if (oldest) pending.delete(oldest);
            }

            const state = randomBytes(16).toString("hex");
            pending.set(state, { expiresAt: Date.now() + STATE_TTL_MS });

            const link = new URL("/link", config.publish.url);
            link.searchParams.set("port", port);
            link.searchParams.set("state", state);

            // 어느 제공자를 고를지 힌트로 넘긴다. 모르는 값이면 마켓플레이스가 직접 고르게 둔다.
            const provider = (body as { provider?: unknown }).provider;
            if (provider === "github" || provider === "google") {
              link.searchParams.set("provider", provider);
            }

            json(res, { url: link.toString() });
          })
          .catch((err: unknown) => json(res, { error: String(err) }, 400));
        return true;
      }

      json(res, { error: "not found" }, 404);
      return true;
    },
  };
}
