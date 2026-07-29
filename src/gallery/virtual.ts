import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import type { ResolvedConfig } from "../config/types.js";
import { listEntries, listEntryNames } from "../registry/entry.js";
import { readHistory } from "../registry/history.js";
import { elementPaths } from "../registry/paths.js";

/**
 * 소비자 데이터를 갤러리에 주입하는 가상 모듈.
 *
 * ── 왜 가상 모듈인가
 * 원본 하네스는 갤러리 소스에서 `import.meta.glob("../../../ui/harness/registry/entries/*.json")`
 * 처럼 **상대경로로 패키지 경계를 넘어** 데이터를 읽었다. 그 상대경로가 곧 모노레포 구조를 전제하므로,
 * 다른 프로젝트에 그대로 옮길 수 없다.
 *
 * 여기서는 그 방향을 뒤집는다 — 갤러리 소스는 `virtual:ie/entries` 만 알고, 해석된 설정을 읽어
 * 실제 파일을 찾아 모듈을 **생성하는 쪽**이 이 플러그인이다. 소비자의 디렉토리 구조가 무엇이든
 * 갤러리 코드는 한 줄도 바뀌지 않는다.
 *
 * ── 데모를 lazy 로 두는 이유
 * 컴포넌트가 100개 쌓이면 그 transitive 의존(차트·모션 라이브러리 등)이 전부 부팅 번들로 들어온다.
 * 동적 import 로 두면 카드가 실제로 화면에 들어올 때만 청크를 가져온다.
 */

export const VIRTUAL_IDS = {
  entries: "virtual:ie/entries",
  demos: "virtual:ie/demos",
  history: "virtual:ie/history",
  config: "virtual:ie/config",
  styles: "virtual:ie/styles.css",
} as const;

const RESOLVED_PREFIX = "\0";

/** JS 소스에 안전하게 박아 넣기 위한 문자열 리터럴. 경로에 백슬래시·따옴표가 있어도 깨지지 않는다. */
function literal(value: unknown): string {
  return JSON.stringify(value);
}

export interface VirtualPluginOptions {
  config: ResolvedConfig;
  /** 갤러리 소스 디렉토리(패키지 안). Tailwind 스캔 대상에 넣는다. */
  galleryDir: string;
}

export function ieVirtual({ config, galleryDir }: VirtualPluginOptions): Plugin {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const virtualIds = new Set<string>(Object.values(VIRTUAL_IDS));

  function buildEntries(): string {
    const entries = listEntries(dirs);
    return `export const entries = ${literal(entries)};\nexport default entries;\n`;
  }

  /**
   * 데모 모듈 지도. 절대 fs 경로로 동적 import 를 생성하므로 소비자 디렉토리가 어디에 있든 동작한다
   * (`server.fs.allow` 에 프로젝트 루트가 들어 있어야 한다 — server.ts 가 넣는다).
   */
  function buildDemos(): string {
    const lines: string[] = ["export const demoLoaders = {"];
    for (const name of listEntryNames(dirs)) {
      const demo = elementPaths(dirs, name).demo;
      if (!existsSync(demo)) continue;
      lines.push(`  ${literal(name)}: () => import(${literal(demo)}),`);
    }
    lines.push("};", "export default demoLoaders;", "");
    return lines.join("\n");
  }

  function buildHistory(): string {
    const byName: Record<string, unknown[]> = {};
    for (const name of listEntryNames(dirs)) {
      const events = readHistory(dirs, name);
      if (events.length > 0) byName[name] = events;
    }
    return `export const historyByName = ${literal(byName)};\nexport default historyByName;\n`;
  }

  function buildConfig(): string {
    // 갤러리 화면이 실제로 쓰는 것만 넘긴다 — 절대경로 전체를 브라우저에 흘리지 않는다.
    const view = {
      title: config.gallery.title,
      importAlias: config.importAlias,
      host: config.gallery.host,
      port: config.gallery.port,
      validate: config.validate,
    };
    return `export const galleryConfig = ${literal(view)};\nexport default galleryConfig;\n`;
  }

  /**
   * 갤러리 진입 CSS 를 생성한다.
   *
   * 토큰 CSS 는 **`@import` 로 참조**하고 인라인하지 않는다. 토큰 파일이 다시 자기 이웃 파일을
   * 상대경로로 `@import` 하는 게 정상이기 때문 — 내용을 통째로 붙이면 그 상대경로들이 기준을
   * 잃고 해석에 실패한다. 대신 이 가상 모듈의 **해석된 id 를 토큰 파일과 같은 디렉토리로 두어**
   * (`stylesModuleId`) 상대 해석 기준을 실제 디렉토리로 만들어 준다. 그러면 라이브러리 기본
   * 토큰이든 소비자가 갈아끼운 토큰이든 자기 이웃을 그대로 부를 수 있다.
   *
   * 갤러리 크롬 CSS 는 상대 참조가 없어 그냥 인라인한다.
   *
   * `source(none)` 으로 자동 스캔을 끄고 대상을 명시한다: 갤러리 자신 + 소비자 컴포넌트.
   * 안 그러면 프로젝트 전체를 훑어 쓰지도 않는 유틸을 대량 생성한다.
   */
  function buildStyles(): string {
    return [
      '@import "tailwindcss" source(none);',
      `@source ${literal(join(galleryDir, "src"))};`,
      `@source ${literal(config.elementsDir)};`,
      "",
      `@import ${literal(config.tokens.css)};`,
      "",
      readIfExists(join(galleryDir, "src", "styles.css")),
    ].join("\n");
  }

  function readIfExists(path: string): string {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return `/* 읽지 못함: ${path} */`;
    }
  }

  /**
   * 스타일 모듈만 `\0virtual:` 이 아니라 **토큰 파일 옆의 실재하지 않는 경로**로 해석한다.
   *
   * CSS 의 `@import` 는 "지금 이 파일이 있는 디렉토리"를 기준으로 상대경로를 푼다. 가상 id 에는
   * 그 디렉토리가 없어 토큰 파일 내부의 `@import "./tokens.css"` 가 엉뚱한 곳을 찾는다.
   * id 를 토큰 파일과 같은 디렉토리에 두면 기준이 실제 디렉토리가 되어 정상 해석된다.
   * 파일이 실제로 없어도 상관없다 — load 훅이 먼저 내용을 돌려주므로 디스크를 읽지 않는다.
   */
  const stylesModuleId = join(dirname(config.tokens.css), "__instant-elements-gallery.css");

  const builders: Record<string, () => string> = {
    [`${RESOLVED_PREFIX}${VIRTUAL_IDS.entries}`]: buildEntries,
    [`${RESOLVED_PREFIX}${VIRTUAL_IDS.demos}`]: buildDemos,
    [`${RESOLVED_PREFIX}${VIRTUAL_IDS.history}`]: buildHistory,
    [`${RESOLVED_PREFIX}${VIRTUAL_IDS.config}`]: buildConfig,
    [stylesModuleId]: buildStyles,
  };

  /** 파일 변경 시 무효화할 실제 모듈 id. */
  const resolvedIdOf = (virtualId: string): string =>
    virtualId === VIRTUAL_IDS.styles ? stylesModuleId : `${RESOLVED_PREFIX}${virtualId}`;

  return {
    name: "instant-elements:virtual",
    enforce: "pre",

    resolveId(id) {
      if (!virtualIds.has(id)) return null;
      return resolvedIdOf(id);
    },

    load(id) {
      const build = builders[id];
      return build ? build() : null;
    },

    configureServer(server) {
      // 레지스트리와 컴포넌트 디렉토리를 감시한다. 파일이 바뀌면 해당 가상 모듈을 무효화해
      // 브라우저가 새 데이터를 받는다 — 엔트리를 추가하고 갤러리를 재시작할 필요가 없다.
      server.watcher.add([config.entriesDir, config.elementsDir, config.tokens.css]);

      const invalidate = (ids: string[]): void => {
        for (const id of ids) {
          const mod = server.moduleGraph.getModuleById(resolvedIdOf(id));
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      };

      const onChange = (file: string): void => {
        const touched: string[] = [];
        if (file.startsWith(config.entriesDir)) {
          touched.push(
            file.endsWith(".history.jsonl") ? VIRTUAL_IDS.history : VIRTUAL_IDS.entries,
          );
          // 엔트리가 늘고 줄면 데모 지도도 함께 바뀐다.
          if (file.endsWith(".json")) touched.push(VIRTUAL_IDS.demos);
        }
        if (file.startsWith(config.elementsDir) && file.endsWith(".demo.tsx")) {
          touched.push(VIRTUAL_IDS.demos);
        }
        if (file === config.tokens.css) touched.push(VIRTUAL_IDS.styles);

        if (touched.length === 0) return;
        invalidate(touched);
        // 가상 모듈은 의존 그래프가 얕아 부분 갱신이 오히려 어긋나기 쉽다 — 전체 리로드가 확실하다.
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
