import { useState, type CSSProperties } from "react";
import { cn } from "../lib/cn";

/**
 * 아바타 — 의존성 0.
 *
 * 히스토리에 "누가 고쳤나"가 이름 문자열로만 남으면 목록을 훑을 때 사람이 구분되지 않는다.
 * 색과 이니셜만 있어도 "아, 저 사람 것"이 한눈에 잡힌다.
 *
 * ── 색을 `style` 로 주는 이유
 * Tailwind JIT 는 **소스에 문자열로 적힌 클래스만** 만든다. `bg-${color}` 처럼 런타임에 조립한
 * 이름은 CSS 가 아예 생성되지 않아 조용히 무색이 된다. 그래서 배경/글자색은 클래스가 아니라
 * 인라인 스타일로 넘긴다.
 */

/**
 * 아바타 바탕 8단계 — **색상이 아니라 밝기**로 사람을 가른다.
 *
 * 팔레트가 무채색이라(styles/colors.css) 아바타만 유채색이면 화면에서 그것만 떠 보인다.
 * 이 디자인 시스템이 위계를 만드는 방식 그대로, 명도만 벌려 8단계를 만든다.
 *
 * 범위를 중간대(0.29~0.71 상대휘도)로 좁힌 이유: 양 끝까지 벌리면 가장 어두운 것이 다크
 * 배경에, 가장 밝은 것이 라이트 배경에 묻힌다. 두 테마 모두에서 원이 원으로 보여야 한다.
 */
const TEMPLATE_COLORS = [
  "#4a4a4a",
  "#5c5c5c",
  "#6e6e6e",
  "#808080",
  "#929292",
  "#a4a4a4",
  "#b6b6b6",
  "#c8c8c8",
] as const;

/** 문자열 → 안정적인 색 인덱스. 같은 이름은 어느 화면에서든 같은 색이어야 한다. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    // 31 배수 누적 — 자바의 String.hashCode 와 같은 고전적인 방식. 분포가 고르고 짧다.
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TEMPLATE_COLORS[Math.abs(hash) % TEMPLATE_COLORS.length] as string;
}

/**
 * 배경 위에서 읽히는 글자색.
 *
 * 무조건 흰 글자로 두면 노랑 계열에서 읽을 수 없다. WCAG 상대휘도를 계산해 0.179
 * (검정/흰색의 대비가 뒤집히는 지점)를 기준으로 고른다.
 */
function contrastTextColor(hex: string): string {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

/**
 * 표시 이름 → 이니셜.
 *
 * 한글·한자처럼 단어를 공백으로 나누지 않는 문자는 첫 글자 하나만 쓴다 — "김철수"에서 "김철"을
 * 뽑으면 이니셜이 아니라 잘린 이름으로 읽힌다.
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const first = trimmed[0] as string;
  if (/[　-鿿가-힯]/.test(first)) return first;

  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

const SIZES = {
  xs: "size-5 text-[0.5rem]",
  sm: "size-6 text-[0.5625rem]",
  md: "size-8 text-step-n2",
  lg: "size-16 text-step-1",
} as const;

export interface AvatarProps {
  /** 이니셜과 색의 근거. 로그인 이름이든 표시 이름이든 **한 화면 안에서는 같은 값**을 써야 한다. */
  name: string;
  /** 없거나 로드에 실패하면 이니셜로 떨어진다. */
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  // 이미지가 깨졌을 때 빈 사각형을 남기지 않고 이니셜로 되돌아가기 위한 플래그.
  const [broken, setBroken] = useState(false);
  const background = colorFor(name);
  const style: CSSProperties = { backgroundColor: background, color: contrastTextColor(background) };
  const shell = cn(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
    "font-medium leading-none",
    SIZES[size],
    className,
  );

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        // 남의 서버(github.com/<login>.png 등)에 우리 쪽 방문 정보를 흘리지 않는다.
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn(shell, "object-cover")}
      />
    );
  }

  return (
    <span aria-hidden className={shell} style={style}>
      {getInitials(name)}
    </span>
  );
}

/**
 * 기여자 묶음.
 *
 * 히스토리에 열 명이 남아도 헤더에 열 개를 늘어놓으면 그 줄이 화면을 다 먹는다. 넘치는 만큼은
 * `+N` 하나로 접는다.
 */
export function AvatarGroup({
  people,
  max = 4,
  size = "sm",
}: {
  people: { name: string; src?: string | null }[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((person) => (
        <span key={person.name} title={person.name} className="-ml-1.5 first:ml-0">
          <Avatar
            name={person.name}
            src={person.src}
            size={size}
            // 겹쳐 놓으면 경계가 사라져 몇 명인지 안 보인다 — 배경색 링으로 떼어 놓는다.
            className="ring-2 ring-st-background"
          />
        </span>
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            "-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full",
            "bg-st-muted font-medium text-st-muted-foreground ring-2 ring-st-background",
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
