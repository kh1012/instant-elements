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

/**
 * GitHub 마크 — 로고는 선이 아니라 **면**이라 base 의 stroke 설정을 덮는다.
 * (그대로 두면 실루엣 대신 윤곽선만 그려져 알아볼 수 없다.)
 */
export function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

/** Google 마크. 공식 로고는 4색이지만 갤러리 아이콘은 전부 currentColor 라 결을 맞춘다. */
export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M12 11v2.8h4.6a4 4 0 0 1-1.72 2.6l2.78 2.16C19.28 17.1 20 14.7 20 12.2c0-.58-.05-1.14-.15-1.68H12Z" />
      <path d="M12 20c2.34 0 4.3-.77 5.73-2.1l-2.78-2.16c-.77.52-1.76.83-2.95.83-2.27 0-4.19-1.53-4.88-3.59l-2.87 2.22A8 8 0 0 0 12 20Z" />
      <path d="M7.12 12.98a4.8 4.8 0 0 1 0-3.06L4.25 7.7a8 8 0 0 0 0 7.5l2.87-2.22Z" />
      <path d="M12 6.98c1.28 0 2.42.44 3.32 1.3l2.47-2.47A8 8 0 0 0 4.25 7.7l2.87 2.22C7.81 7.86 9.73 6.98 12 6.98Z" />
    </svg>
  );
}

/** 실행 로그 — 프롬프트 꺾쇠와 커서 줄. 터미널을 아는 사람이면 형태만으로 안다. */
export function TerminalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m5 8 3.5 3.5L5 15" />
      <path d="M12.5 15H18" />
    </svg>
  );
}

/** 도움말 — 물음표 원. */
export function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

/** 맨 위로 — 위 화살표. */
export function ArrowUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

/** 새로 만들기 — 더하기. */
export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/** 선택기 펼침 표시. */
export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** 그리드 뷰 — 카드 격자. (GridIcon 은 네비에서 쓰이므로 별도.) */
export function ViewGridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** 목록 뷰 — 줄 세 개. */
export function ViewListIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

/** 밀도 — 행 간격을 좁힌다. */
export function DensityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16" />
      <path d="M4 11h16" />
      <path d="M4 15h16" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** 초기화 — 되돌리는 화살표. */
export function ResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

/** 이전 컴포넌트. */
export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** 다음 컴포넌트. */
export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** 더 보기 — 세로 점 셋. */
export function KebabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}
