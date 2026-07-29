/**
 * instant-elements — 코딩 에이전트 기반 UI 하네스.
 *
 * 설명하면 만들어지고(`/element-create`), 갤러리에서 보이고, 수정 프롬프트로 고쳐지고,
 * 모든 변경이 기록된다. 프로그램적 사용을 위한 공개 표면은 여기서만 노출한다.
 */
export { defineConfig } from "./config.js";
export type {
  ElementCategory,
  ElementStatus,
  GalleryOptions,
  InstantElementsConfig,
  ResolvedConfig,
  TokenOptions,
  ValidateOptions,
} from "./config/types.js";
export { packageName, packageVersion } from "./pkg.js";
