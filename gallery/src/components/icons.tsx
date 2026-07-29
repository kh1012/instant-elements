import type { SVGProps } from "react";

/**
 * 인라인 아이콘 — 아이콘 라이브러리를 들이지 않는다.
 *
 * 갤러리가 쓰는 아이콘은 손에 꼽고, 그 편의로 소비 프로젝트 번들과 얽힐 의존을 늘릴 이유가 없다.
 * **형태가 확연히 달라야 스캔이 된다** — 비슷한 실루엣 셋을 나란히 두면 라벨 없이 구분이 안 된다.
 */

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

/** 가져다 쓰기 — 겹친 사각형. */
export function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** 고치기 — 지팡이. 프롬프트는 AI 에게 시키는 것이라 손으로 고치는 연필보다 이쪽이 맞다. */
export function WandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m3 21 9-9" />
      <path d="M15 4 13.5 6.5 11 8l2.5 1.5L15 12l1.5-2.5L19 8l-2.5-1.5z" />
      <path d="M20 15v3" />
      <path d="M18.5 16.5h3" />
    </svg>
  );
}

/** 쪼개기 — 갈라지는 화살표. */
export function SplitIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22V12" />
      <path d="M21 3l-6.5 6.5a2 2 0 0 0-.5 1.3V12" />
      <path d="M3 3l6.5 6.5a2 2 0 0 1 .5 1.3V12" />
    </svg>
  );
}
