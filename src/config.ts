/**
 * `instant-elements/config` 공개 진입점.
 *
 * 사용:
 * ```ts
 * // instant.config.ts
 * import { defineConfig } from "instant-elements/config";
 *
 * export default defineConfig({
 *   elementsDir: "src/elements",
 *   importAlias: "@/elements",
 * });
 * ```
 */
export type {
  ElementCategory,
  ElementStatus,
  GalleryOptions,
  InstantElementsConfig,
  ResolvedConfig,
  TokenOptions,
  ValidateOptions,
} from "./config/types.js";

import type { InstantElementsConfig } from "./config/types.js";

/**
 * 설정 객체에 타입을 입히는 항등 함수. 런타임 동작은 없고 편집기 자동완성·타입검사만 제공한다.
 */
export function defineConfig(config: InstantElementsConfig): InstantElementsConfig {
  return config;
}
