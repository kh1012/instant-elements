import type { Connect } from "vite";

/**
 * 갤러리 API 모듈들이 함께 쓰는 HTTP 손잡이.
 *
 * `json`·`readBody`·CSRF 가드가 api / api-pages / api-agent 에 각각 복사돼 있었다. 네 번째
 * 모듈(신원)을 붙이면서 하나로 모은다 — 특히 CSRF 가드가 갈라지면 **한 곳만 고치고 다른 곳을
 * 놓치는 순간 그 라우트가 조용히 열린다.**
 */

export type Req = Parameters<Connect.NextHandleFunction>[0];
export type Res = Parameters<Connect.NextHandleFunction>[1];

export function json(res: Res, body: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/** 요청 바디를 읽는다. 공유 dev 서버를 무한 바디로 죽이지 않게 상한을 둔다. */
export function readBody(req: Req, limit = 512_000): Promise<unknown> {
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
 * - `origin` 대조 — 헤더가 없는 클라이언트(curl 등)를 위한 이중 확인.
 *
 * 기준은 **요청의 `Host`** 다. 설정값(`config.gallery.port`)으로 허용목록을 만들면 `ie gallery
 * --port` 로 띄웠을 때 실제 포트와 어긋나 정상 요청이 전부 403 이 된다. 브라우저가 우리에게
 * 말을 건 주소가 곧 우리 origin 이므로, 그것과 같은지만 보면 포트가 무엇이든 맞는다.
 */
export function isSameOrigin(req: Req): boolean {
  const site = req.headers["sec-fetch-site"];
  if (typeof site === "string" && site !== "same-origin") return false;

  const origin = req.headers["origin"];
  if (typeof origin !== "string") return true; // 브라우저가 아닌 클라이언트 — sec-fetch-site 로 이미 걸렀다.

  const host = req.headers.host;
  if (typeof host !== "string") return false;

  // localhost 와 127.0.0.1 은 같은 곳이지만 문자열은 다르다 — 한쪽으로 접속해 다른 쪽 이름이
  // origin 에 실리는 경우는 없지만, 포트만 떼어 양쪽을 모두 인정해 두면 헷갈릴 일이 없다.
  const port = host.split(":")[1];
  const allowed = port
    ? new Set([`http://${host}`, `http://localhost:${port}`, `http://127.0.0.1:${port}`])
    : new Set([`http://${host}`]);
  return allowed.has(origin);
}
