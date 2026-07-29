import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { CliError } from "../cli/ui.js";
import type { ResolvedConfig } from "../config/types.js";
import { packageRoot } from "../pkg.js";
import { ieApi } from "./api.js";
import { ieVirtual } from "./virtual.js";

/** 패키지 안의 갤러리 소스 위치. 빌드 산출물이 아니라 소스 그대로 실려 Vite 가 dev 로 돌린다. */
export const galleryDir = join(packageRoot, "gallery");

export interface StartGalleryOptions {
  config: ResolvedConfig;
  port?: number;
  host?: string;
  open?: boolean;
}

/**
 * 갤러리 dev 서버를 프로그램적으로 띄운다.
 *
 * 디스크의 `vite.config.ts` 를 쓰지 않는다(`configFile: false`) — 설정이 소비 프로젝트마다 다르게
 * 계산되므로 정적 파일로 표현할 수 없다. 대신 해석된 설정을 그대로 받아 여기서 구성한다.
 */
export async function startGallery(options: StartGalleryOptions): Promise<ViteDevServer> {
  const { config } = options;

  if (!existsSync(galleryDir)) {
    throw new CliError("갤러리 소스를 찾지 못했습니다.", {
      exitCode: 70,
      hint: `${galleryDir} 가 없습니다 — 패키지 설치가 손상된 것 같습니다.`,
    });
  }

  const [{ default: react }, { default: tailwindcss }] = await Promise.all([
    import("@vitejs/plugin-react"),
    import("@tailwindcss/vite"),
  ]);

  const server = await createServer({
    configFile: false,
    root: galleryDir,
    // 브라우저 콘솔에 우리 이름으로 로그가 남게.
    appType: "spa",
    plugins: [react(), tailwindcss(), ieVirtual({ config, galleryDir }), ieApi(config)],
    server: {
      host: options.host ?? config.gallery.host,
      port: options.port ?? config.gallery.port,
      // 포트를 조용히 옮기면 "딥링크는 9221"이라는 약속이 깨진다. 점유 중이면 차라리 실패한다.
      strictPort: true,
      open: options.open ?? config.gallery.open,
      // 갤러리(패키지 안)와 소비자 컴포넌트(프로젝트 안)는 서로 다른 트리에 있다.
      // 데모를 절대경로로 import 하므로 두 루트를 모두 허용해야 한다.
      fs: { allow: [packageRoot, config.root] },
    },
    resolve: {
      // 갤러리와 소비자 컴포넌트가 **같은 React 인스턴스**를 써야 한다. 두 벌이면 훅이 깨진다.
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      // 소비자 컴포넌트는 프로젝트 node_modules 에서 해석된다 — 사전 번들 대상에서 제외해
      // 갤러리 기동 때마다 전체를 다시 스캔하지 않게 한다.
      entries: [join(galleryDir, "index.html")],
    },
  });

  await server.listen();
  return server;
}

/** 포트 점유 오류를 사람이 읽는 안내로 바꾼다. */
export function describeListenError(error: unknown, port: number): CliError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("EADDRINUSE") || message.includes("in use")) {
    return new CliError(`포트 ${port} 가 이미 사용 중입니다.`, {
      exitCode: 75,
      hint: `이미 갤러리가 떠 있는지 확인해 보세요: curl -s http://127.0.0.1:${port}/api/health`,
    });
  }
  return new CliError(`갤러리를 띄우지 못했습니다: ${message}`, { exitCode: 70 });
}
