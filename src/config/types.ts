/**
 * instant-elements 설정 타입.
 *
 * 이 라이브러리의 일반화는 전적으로 이 설정에 달려 있다 — 원본 하네스가 모노레포 경로를 문자열로
 * 박아 두었던 자리를 전부 여기로 옮긴다. CLI·갤러리·스킬 GUIDE 는 경로를 직접 알지 못하고
 * `ie config --json` 이 내놓는 **해석된 절대경로**만 본다.
 */

/** 재사용 판정과 갤러리 필터에 쓰는 분류. 원본의 Composite/Animations/System 을 그대로 계승한다. */
export type ElementCategory = "Composite" | "Animations" | "System";

/**
 * 라이프사이클 라벨. 승격·머지 자동화(component-curate/apply)는 이 라이브러리에 없으므로
 * 상태 전이도 없다 — 사람이 손으로 붙이는 표시일 뿐이고 갤러리 필터칩에만 쓰인다.
 */
export type ElementStatus = "draft" | "stable";

export interface GalleryOptions {
  /** 갤러리 dev 서버 포트. 기본 9221. */
  port?: number;
  /** 바인딩 호스트. 기본 "127.0.0.1"(로컬 전용 — 개발 도구라 외부 노출하지 않는다). */
  host?: string;
  /** 브라우저 자동 열기. 기본 false. */
  open?: boolean;
  /** 갤러리 헤더에 표시할 프로젝트 이름. 기본 package.json 의 name. */
  title?: string;
}

export interface TokenOptions {
  /**
   * `st-*` 토큰을 공급하는 CSS 진입점.
   * - 생략하면 라이브러리 기본 토큰(`instant-elements/theme.css`)을 쓴다.
   * - 프로젝트 상대경로를 주면 그 파일로 대체한다(기존 디자인 시스템 연결).
   */
  css?: string;
}

export interface ValidateOptions {
  /** 본체 .tsx 의 유채색 리터럴(hex/rgb/hsl/oklch) 차단. 기본 true. */
  colorLiterals?: boolean;
  /** 스케일 밖 arbitrary 값(`w-[13px]` 등) 차단. 기본 true. */
  arbitraryValues?: boolean;
  /** 애니메이션 계약(target/behavior/standalone) 검증. 기본 true. */
  animation?: boolean;
}

export interface InstantElementsConfig {
  /**
   * 생성된 컴포넌트 3파일(`<name>.tsx` · `<name>.demo.tsx` · `index.ts`)이 사는 디렉토리.
   * 프로젝트 루트 기준 상대경로. 기본 "src/elements".
   */
  elementsDir?: string;
  /**
   * 앱 코드가 컴포넌트를 import 할 때 쓰는 별칭. 프롬프트·사용예제에 그대로 박히므로
   * tsconfig paths / 번들러 alias 와 일치해야 한다. 기본 "@/elements".
   */
  importAlias?: string;
  /** 레지스트리(entries/*.json · index.json · *.history.jsonl). 기본 ".instant/registry". */
  registryDir?: string;
  /** 페이지 저장소(pages/<slug>.json + 사이드카). 기본 ".instant/pages". */
  pagesDir?: string;
  /** 흐름 저장소(flows/<slug>.json). 기본 ".instant/flows". */
  flowsDir?: string;
  tokens?: TokenOptions;
  gallery?: GalleryOptions;
  validate?: ValidateOptions;
}

/**
 * 기본값이 모두 채워지고 경로가 절대경로로 해석된 설정. CLI·갤러리는 이 형태만 다룬다.
 */
export interface ResolvedConfig {
  /** 설정 파일이 발견된 프로젝트 루트(절대경로). */
  root: string;
  /** 읽어들인 설정 파일 절대경로. 파일 없이 기본값으로 동작하면 null. */
  configFile: string | null;
  elementsDir: string;
  importAlias: string;
  registryDir: string;
  entriesDir: string;
  indexFile: string;
  pagesDir: string;
  flowsDir: string;
  tokens: { css: string };
  gallery: Required<Omit<GalleryOptions, "title">> & { title: string };
  validate: Required<ValidateOptions>;
}
