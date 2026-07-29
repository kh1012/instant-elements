/**
 * 가상 모듈 타입 선언.
 *
 * 런타임에는 `src/gallery/virtual.ts` 플러그인이 해석된 설정을 읽어 이 모듈들을 생성한다.
 * 여기서는 그 **표면만** 선언해 갤러리 소스가 타입 검사를 받을 수 있게 한다.
 * 플러그인이 내는 모양이 바뀌면 여기도 함께 고친다.
 */

declare module "virtual:ie/entries" {
  import type { Entry } from "instant-elements/registry";
  export const entries: Entry[];
  export default entries;
}

declare module "virtual:ie/demos" {
  import type { ComponentType } from "react";
  /** 컴포넌트 이름 → 데모 모듈 동적 import. 화면에 들어올 때만 청크를 가져온다. */
  export const demoLoaders: Record<string, () => Promise<{ default: ComponentType }>>;
  export default demoLoaders;
}

declare module "virtual:ie/components" {
  import type { ComponentType } from "react";
  /**
   * 컴포넌트 이름 → 본체 모듈 동적 import.
   * 데모와 달리 **페이지가 지정한 props 를 받는 실 컴포넌트**를 준다.
   */
  export const componentLoaders: Record<
    string,
    () => Promise<{ default: ComponentType<Record<string, unknown>> }>
  >;
  export default componentLoaders;
}

declare module "virtual:ie/history" {
  import type { HistoryEvent } from "instant-elements/registry";
  export const historyByName: Record<string, HistoryEvent[]>;
  export default historyByName;
}

declare module "virtual:ie/config" {
  export interface GalleryConfigView {
    title: string;
    importAlias: string;
    host: string;
    port: number;
    validate: { colorLiterals: boolean; arbitraryValues: boolean; animation: boolean };
  }
  export const galleryConfig: GalleryConfigView;
  export default galleryConfig;
}

declare module "virtual:ie/styles.css";
