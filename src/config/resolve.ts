import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { findProjectRoot } from "../cli/project.js";
import { packageRoot } from "../pkg.js";
import { BUILTIN_TOKENS_SPEC, DEFAULTS } from "./defaults.js";
import { loadConfigFile, readPackageJsonConfig } from "./load.js";
import type { ResolvedConfig } from "./types.js";
import { validateConfig, type NormalizedInput } from "./validate.js";

/** 라이브러리 내장 토큰 CSS 의 실제 위치. `styles/` 는 패키지에 그대로 실린다(번들 대상 아님). */
export const builtinTokensFile = join(packageRoot, "styles", "theme.css");

/**
 * `tokens.css` 스펙을 절대경로로. `instant-elements/…` 로 시작하면 패키지 안에서, 그 외에는
 * 프로젝트 루트 기준으로 해석한다 — 소비자가 자기 디자인 시스템 토큰으로 갈아끼울 수 있는 지점.
 */
export function resolveTokensCss(spec: string, root: string): string {
  if (spec === BUILTIN_TOKENS_SPEC) return builtinTokensFile;
  if (spec.startsWith("instant-elements/")) {
    return join(packageRoot, spec.slice("instant-elements/".length));
  }
  return resolve(root, spec);
}

export interface ResolveOptions {
  /** 탐색을 시작할 디렉토리. 기본 process.cwd(). */
  cwd?: string;
  /** 설정 파일을 직접 지정(탐색 건너뜀). */
  configFile?: string;
}

/**
 * 설정을 찾고, 검증하고, 기본값을 덮고, 모든 경로를 절대경로로 만든다.
 *
 * 이 함수의 반환값이 CLI·갤러리·스킬이 보는 **유일한 경로 진실**이다. 설정 파일이 아예 없어도
 * 기본값으로 완전한 ResolvedConfig 를 돌려준다 — `ie init` 이전에도 doctor 가 동작해야 하기 때문.
 */
export async function resolveConfig(options: ResolveOptions = {}): Promise<ResolvedConfig> {
  const cwd = options.cwd ?? process.cwd();

  let root: string;
  let configFile: string | null;
  if (options.configFile) {
    configFile = resolve(options.configFile);
    root = resolve(configFile, "..");
  } else {
    const found = findProjectRoot(cwd);
    root = found.root;
    configFile = found.configFile;
  }

  let input: NormalizedInput = {};
  if (configFile) {
    input = validateConfig(await loadConfigFile(configFile), basename(configFile));
  }

  const packageJsonFile = join(root, "package.json");
  const pkg = existsSync(packageJsonFile)
    ? readPackageJsonConfig(packageJsonFile)
    : { config: undefined, name: null };

  // 설정 파일이 없을 때만 package.json#instantElements 를 본다 — 두 곳에 흩어진 설정은
  // "어느 쪽이 이기는지"를 매번 되묻게 만든다. 한 프로젝트엔 진실이 하나여야 한다.
  if (!configFile && pkg.config !== undefined) {
    input = validateConfig(pkg.config, "package.json#instantElements");
  }

  const elementsDir = input.elementsDir ?? DEFAULTS.elementsDir;
  const registryDir = input.registryDir ?? DEFAULTS.registryDir;
  const pagesDir = input.pagesDir ?? DEFAULTS.pagesDir;
  const flowsDir = input.flowsDir ?? DEFAULTS.flowsDir;
  const tokensCss = input.tokensCss ?? DEFAULTS.tokens.css;
  const registryAbs = resolve(root, registryDir);

  return {
    root,
    configFile,
    elementsDir: resolve(root, elementsDir),
    importAlias: input.importAlias ?? DEFAULTS.importAlias,
    registryDir: registryAbs,
    entriesDir: join(registryAbs, "entries"),
    indexFile: join(registryAbs, "index.json"),
    pagesDir: resolve(root, pagesDir),
    flowsDir: resolve(root, flowsDir),
    tokens: { css: resolveTokensCss(tokensCss, root) },
    gallery: {
      port: input.galleryPort ?? DEFAULTS.gallery.port,
      host: input.galleryHost ?? DEFAULTS.gallery.host,
      open: input.galleryOpen ?? DEFAULTS.gallery.open,
      title: input.galleryTitle ?? pkg.name ?? basename(root),
      agent: input.galleryAgent ?? DEFAULTS.gallery.agent,
    },
    validate: {
      colorLiterals: input.validateColorLiterals ?? DEFAULTS.validate.colorLiterals,
      arbitraryValues: input.validateArbitraryValues ?? DEFAULTS.validate.arbitraryValues,
      animation: input.validateAnimation ?? DEFAULTS.validate.animation,
    },
    publish: {
      url: input.publishUrl ?? DEFAULTS.publish.url,
      oauthClientId: input.publishOauthClientId ?? DEFAULTS.publish.oauthClientId,
    },
  };
}
