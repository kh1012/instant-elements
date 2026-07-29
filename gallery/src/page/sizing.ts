import type { CSSProperties } from "react";
import type { NodeProps } from "instant-elements/page";

/**
 * 구조 `_`-props 를 실제 CSS 로 방출한다.
 *
 * ── 부모 방향을 알아야 하는 이유
 * `fill` 은 부모가 무엇이냐에 따라 뜻이 달라진다. Row(가로 흐름) 자식이면 `flex: 1 1 0%` 이고,
 * Stack(세로 흐름) 자식이면 `width: 100%` 다. Grid 자식이면 트랙이 정하므로 아무것도 내지 않는다.
 * 부모를 모른 채 `flex:1` 을 내면 Stack 안에서 **세로로** 늘어나 저작 의도와 정반대가 된다.
 *
 * ── 자유 좌표가 없는 이유
 * 값은 전부 고정 세그먼트·스케일이다. x/y 절대좌표를 허용하면 페이지끼리 정렬이 어긋나고,
 * 화면 크기가 바뀔 때 무엇을 어떻게 옮겨야 하는지 아무도 답할 수 없게 된다. 흐름(flow) 전용이다.
 */

export type ParentFlow = "row" | "column" | "grid" | "none";

/**
 * `_width` 는 세 형태가 섞여 들어온다: `"264px"` · `"1/4"` · `"23%"`.
 * 분수는 백분율로 환산한다 — CSS 가 이해하는 형태로 맞춰야 한 곳에서만 다룰 수 있다.
 */
export function parseWidth(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(raw);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator > 0) return `${((numerator / denominator) * 100).toFixed(4).replace(/\.?0+$/, "")}%`;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}px`;
  return raw;
}

const ALIGN_SELF: Record<string, CSSProperties["alignSelf"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

export function sizingStyle(props: NodeProps, parent: ParentFlow): CSSProperties {
  const style: CSSProperties = {};
  const width = parseWidth(props._width);
  const height = parseWidth(props._height);

  switch (props._widthMode) {
    case "fixed":
      if (width) style.width = width;
      style.flexShrink = 0;
      break;
    case "hug":
      // 내용에 맞춘다. Row 자식이면 늘어나지 않도록 flex 기본값도 함께 눌러 준다.
      style.width = "fit-content";
      if (parent === "row") style.flex = "0 0 auto";
      break;
    case "fill":
      if (parent === "row") style.flex = "1 1 0%";
      else if (parent === "column") style.width = "100%";
      // grid 자식은 트랙이 폭을 정한다 — 여기서 손대면 _colSpan 과 싸운다.
      break;
    default:
      if (width) style.width = width;
  }

  if (height) style.height = height;
  if (props._alignSelf && ALIGN_SELF[props._alignSelf]) {
    style.alignSelf = ALIGN_SELF[props._alignSelf];
  }
  if (typeof props._padding === "number") style.padding = props._padding;

  if (parent === "grid") {
    if (typeof props._colSpan === "number") style.gridColumn = `span ${props._colSpan}`;
    if (typeof props._gridColStart === "number") {
      style.gridColumnStart = props._gridColStart;
      if (typeof props._colSpan === "number") {
        style.gridColumnEnd = `span ${props._colSpan}`;
      }
    }
    if (typeof props._gridRow === "number") style.gridRow = `span ${props._gridRow}`;
  }

  return style;
}

/** 컨테이너 타입 → 자식이 놓이는 흐름 방향. */
export function flowOf(type: string): ParentFlow {
  if (type === "Row") return "row";
  if (type === "Stack" || type === "Frame") return "column";
  if (type === "Grid") return "grid";
  return "none";
}
