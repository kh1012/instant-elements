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
  // agent 는 기본 false — 브라우저에서 로컬 파일을 고칠 수 있게 여는 표면이라 명시적으로만 켠다.
  gallery: { port: 9221, host: "127.0.0.1", open: false, agent: false },
  validate: { colorLiterals: true, arbitraryValues: true, animation: true },
  publish: {
    url: "https://instant-elements-marketplace.vercel.app",
    oauthClientId: "Ov23lintmmOZNVZxVRgJ",
  },
} as const satisfies Required<Omit<InstantElementsConfig, "gallery">> & {
  gallery: { port: number; host: string; open: boolean; agent: boolean };
};

/** 라이브러리가 배포하는 기본 토큰 CSS 를 가리키는 스펙. 이 값이면 패키지 안에서 해석한다. */
export const BUILTIN_TOKENS_SPEC = "instant-elements/theme.css";
