/**
 * 토큰 매니페스트 — CSS 로 정의된 토큰의 **이름**을 JS/TS 로 노출한다.
 *
 * 런타임 값은 `styles/colors.css` · `styles/tokens.css` 가 CSS 변수로 공급한다. 이 모듈은
 * (1) 검증 게이트가 "이 클래스가 실재하는 토큰인가"를 판정하고 (2) 갤러리·문서가 목록을
 * 자동 생성하는 데 쓴다. 값이 아니라 어휘가 여기 산다.
 *
 * CSS 와 이 파일이 어긋나면 `src/tokens.test.ts` 가 잡는다(두 방향 모두 검사).
 */

/** border-radius 스케일 → `rounded-*` 유틸 */
export const radius = {
  xs: "3px",
  sm: "4px",
  md: "6px",
  lg: "8px",
  xl: "12px",
} as const;

/** 타입 스케일 → `text-step-*` 유틸 */
export const typeScale = {
  n2: "0.72rem",
  n1: "0.9rem",
  "0": "1rem",
  "1": "1.25rem",
  "2": "1.563rem",
  "3": "1.953rem",
} as const;

/**
 * 타입 스케일의 **작은 것부터** 순서.
 *
 * `Object.keys(typeScale)` 를 쓰지 않는다 — JS 는 정수처럼 보이는 키("0"~"3")를 문자열 키("n2","n1")
 * 앞으로 재정렬하므로 선언 순서가 보존되지 않는다. 순서가 의미를 갖는 곳(문서·검증 목록)은 이 배열을 본다.
 */
export const typeScaleOrder = ["n2", "n1", "0", "1", "2", "3"] as const;

/** named z-index → `z-popover` / `z-modal` / `z-tooltip` 등 */
export const zIndex = {
  popover: 35,
  "modal-backdrop": 45,
  modal: 50,
  "modal-popover": 55,
  tooltip: 60,
} as const;

export const duration = {
  fast: "150ms",
  base: "200ms",
} as const;

/**
 * 코어 시맨틱 색 토큰. 컴포넌트는 `bg-st-<name>` · `text-st-<name>` · `border-st-<name>` 형태로만
 * 색을 참조한다. 이 목록이 재사용 가능한 어휘의 전부이며, 여기 없는 색이 필요하면 코드에 값을
 * 박지 말고 토큰 제안 큐로 보낸다.
 */
export const colorTokens = [
  "background",
  "canvas",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "warning",
  "info",
  "pending",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

/**
 * 컴포넌트 레시피 토큰 — 버튼·입력·뱃지·탭·스위치가 쓰는 조합값. 코어 토큰에서 파생되므로
 * 팔레트를 갈아끼우면 함께 따라온다. 새 컴포넌트는 웬만하면 코어 토큰을 먼저 쓴다.
 */
export const recipeTokens = [
  "button-secondary-border",
  "button-secondary-bg",
  "button-secondary-hover-bg",
  "button-ghost-hover-bg",
  "button-destructive-bg",
  "button-destructive-hover-bg",
  "button-destructive-focus-ring",
  "control-bg",
  "control-hover-bg",
  "control-disabled-bg",
  "control-invalid-border",
  "control-invalid-ring",
  "badge-danger-bg",
  "badge-info-bg",
  "badge-success-bg",
  "interactive-muted-hover-bg",
  "field-checked-border",
  "field-checked-bg",
  "tabs-trigger-fg",
  "tabs-active-border",
  "tabs-active-bg",
  "switch-unchecked-bg",
  "switch-thumb-checked-bg",
  "switch-thumb-unchecked-bg",
] as const;

/** 검증 게이트가 보는 전체 토큰 어휘. */
export const allColorTokens = [...colorTokens, ...recipeTokens] as const;

/** 허용되는 radius 유틸 클래스(검증용). */
export const allowedRadiusClasses = [
  "rounded-none",
  "rounded-xs",
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-full",
] as const;

/** 허용되는 font-size 유틸 클래스(검증용). */
export const allowedTextClasses = typeScaleOrder.map((k) => `text-step-${k}`);

export type RadiusToken = keyof typeof radius;
export type TypeScaleToken = keyof typeof typeScale;
export type ZIndexToken = keyof typeof zIndex;
export type ColorToken = (typeof colorTokens)[number];
export type RecipeToken = (typeof recipeTokens)[number];
