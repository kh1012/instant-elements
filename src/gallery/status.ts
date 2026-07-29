import type { ResolvedConfig } from "../config/types.js";
import { packageVersion } from "../pkg.js";

/**
 * "지금 뜬 갤러리가 **내 프로젝트의** 갤러리인가" 를 먼저 답한다.
 *
 * ── 왜 이 순서가 중요한가
 * 처음에는 `/api/entry/<name>` 이 200 이면 딥링크가 뜬다고 봤다. 그런데 같은 포트를 **다른
 * 프로젝트의 갤러리**가 점유하고 있으면, 그쪽 레지스트리에 우연히 같은 이름이 있을 때
 * 200 을 돌려준다 — 내 컴포넌트는 등록도 안 됐는데 "확인됨" 이 되는 위양성이다.
 * 실제로 `button`·`card` 같은 흔한 이름에서 그대로 재현됐다.
 *
 * 검증 게이트가 거짓말을 하면 없느니만 못하다. 그래서 **신원(app·root) 확인이 먼저**고,
 * 엔트리 확인은 그다음이다.
 */

export type GalleryStatus =
  | { state: "down"; url: string; error: string }
  | { state: "foreign"; url: string; app: string; root: string | null }
  | {
      state: "ours";
      url: string;
      version: string;
      entry?: { name: string; exists: boolean; status?: string };
    };

interface HealthBody {
  app?: unknown;
  version?: unknown;
  root?: unknown;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGallery(
  config: ResolvedConfig,
  options: { entry?: string; timeoutMs?: number } = {},
): Promise<GalleryStatus> {
  const base = `http://${config.gallery.host}:${config.gallery.port}`;
  const timeoutMs = options.timeoutMs ?? 2000;

  let health: { status: number; body: HealthBody };
  try {
    health = (await fetchJson(`${base}/api/health`, timeoutMs)) as {
      status: number;
      body: HealthBody;
    };
  } catch (err) {
    return {
      state: "down",
      url: base,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const app = typeof health.body.app === "string" ? health.body.app : "(알 수 없음)";
  const root = typeof health.body.root === "string" ? health.body.root : null;

  // 우리 갤러리이면서 **같은 프로젝트**를 서빙할 때만 신뢰한다.
  if (app !== "instant-elements-gallery" || root !== config.root) {
    return { state: "foreign", url: base, app, root };
  }

  const result: GalleryStatus = {
    state: "ours",
    url: base,
    version: typeof health.body.version === "string" ? health.body.version : packageVersion,
  };

  if (options.entry) {
    try {
      const response = (await fetchJson(
        `${base}/api/entry/${encodeURIComponent(options.entry)}`,
        timeoutMs,
      )) as { status: number; body: { exists?: unknown; status?: unknown } };
      result.entry = {
        name: options.entry,
        exists: response.status === 200 && response.body.exists === true,
        ...(typeof response.body.status === "string" ? { status: response.body.status } : {}),
      };
    } catch {
      result.entry = { name: options.entry, exists: false };
    }
  }

  return result;
}
