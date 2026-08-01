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
    /*
     * 웹 로그인과 **같은** OAuth 앱을 쓴다.
     *
     * 한때 CLI 용을 따로 두었는데, 그러면 사람들의 GitHub 승인 목록에 비슷한 이름 둘이 뜨고
     * 하나를 취소했을 때 다른 쪽이 왜 계속 되는지 설명할 수 없다. 앱 하나가 Device Flow(CLI)와
     * 웹 플로우를 둘 다 지원하므로 나눌 이유가 없었다 — 서로 다른 grant type 일 뿐이다.
     */
    oauthClientId: "Ov23li6VR0IecaKyFgjW",
  },
} as const satisfies Required<Omit<InstantElementsConfig, "gallery">> & {
  gallery: { port: number; host: string; open: boolean; agent: boolean };
};

/** 라이브러리가 배포하는 기본 토큰 CSS 를 가리키는 스펙. 이 값이면 패키지 안에서 해석한다. */
export const BUILTIN_TOKENS_SPEC = "instant-elements/theme.css";
