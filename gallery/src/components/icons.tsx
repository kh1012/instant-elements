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

/** 고정 — 별. 채움 여부로 상태를 보인다. */
export function StarIcon({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.2l5.9-.9z" />
    </svg>
  );
}

/** 컴포넌트 — 격자. */
export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** 페이지 — 상단 바 + 본문 영역. */
export function PageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

/** 흐름 — 이어진 노드. */
export function FlowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <rect x="3" y="4" width="6" height="6" rx="1.5" />
      <rect x="15" y="14" width="6" height="6" rx="1.5" />
      <path d="M9 7h4a2 2 0 0 1 2 2v8" />
    </svg>
  );
}

/** 커맨드 팔레트 — ⌘ 기호 자체가 힌트다. */
export function CommandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <path d="M15 6a3 3 0 1 1 3 3h-3V6zM9 6a3 3 0 1 0-3 3h3V6zM9 18a3 3 0 1 1-3-3h3v3zM15 18a3 3 0 1 0 3-3h-3v3zM9 9h6v6H9z" />
    </svg>
  );
}

export function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} width={18} height={18} {...props}>
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** 고정 — 핀. 채움 여부로 상태를 보인다(별보다 '꽂아 둔다'는 은유가 맞는다). */
export function PinIcon({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.8V4h6v6.8l2 3.2H7z" />
    </svg>
  );
}
