import type { InstantElementsConfig } from "./types.js";

/**
 * 설정 기본값.
 *
 * `.instant/` 아래에 데이터(레지스트리·페이지·흐름)를 모으는 이유: 소비 프로젝트의 `src/` 를
 * 어지럽히지 않으면서 한 디렉토리만 git 에 커밋하면 하네스 전체가 팀에 공유되기 때문이다.
 * 컴포넌트 코드만 `src/elements/` 로 나가 있는데, 그건 실제 앱이 import 하는 프로덕션 코드라서다.
 */
export const DEFAULTS = {
  elementsDir: "src/elements",
  importAlias: "@/elements",
  registryDir: ".instant/registry",
  pagesDir: ".instant/pages",
  flowsDir: ".instant/flows",
  tokens: { css: "instant-elements/theme.css" },
  gallery: { port: 9221, host: "127.0.0.1", open: false },
  validate: { colorLiterals: true, arbitraryValues: true, animation: true },
  // client id는 실제 GitHub OAuth App(Device Flow 활성화, kh1012 계정) 값. url은 마켓플레이스가
  // 아직 Vercel에 배포되지 않아 플레이스홀더 — 배포되면 실제 도메인으로 교체한다.
  publish: { url: "https://registry.instant-elements.dev", oauthClientId: "Ov23lintmmOZNVZxVRgJ" },
} as const satisfies Required<Omit<InstantElementsConfig, "gallery">> & {
  gallery: { port: number; host: string; open: boolean };
};

/** 라이브러리가 배포하는 기본 토큰 CSS 를 가리키는 스펙. 이 값이면 패키지 안에서 해석한다. */
export const BUILTIN_TOKENS_SPEC = "instant-elements/theme.css";
