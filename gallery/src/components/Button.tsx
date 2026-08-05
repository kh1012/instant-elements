import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

/*
 * 표면은 **여기서만** 정한다.
 *
 * `cn` 은 단순 join 이라(tailwind-merge 없음) 호출부에서 `className="bg-…"` 로 덮으면 두 배경
 * 클래스가 함께 남고, 승자는 생성된 CSS 의 순서가 정한다 — 화면마다 다르게 보이고 원인을 못 찾는다.
 * 새 표면이 필요하면 variant 를 늘린다.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-st-primary text-st-primary-foreground hover:opacity-90",
  outline:
    "border border-st-button-secondary-border bg-st-button-secondary-bg hover:bg-st-button-secondary-hover-bg",
  ghost: "hover:bg-st-button-ghost-hover-bg",
  /** 되돌릴 수 없는 조작. 한 화면에 하나만 있어야 색이 경고로 읽힌다. */
  danger:
    "border border-st-destructive/40 bg-st-destructive/10 text-st-destructive hover:bg-st-destructive/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-step-n2",
  md: "h-9 px-3 text-step-n1",
};

/**
 * 갤러리 크롬 전용 버튼.
 *
 * 모서리는 **완전한 알약**이다. 헤더 pill·아바타·상태 뱃지가 이미 원형 계열이라, 버튼만
 * 각지면 같은 화면에서 두 가지 언어가 섞인다.
 *
 * **소비 프로젝트의** 컴포넌트 라이브러리에 의존하지 않는다 — 갤러리가 소비자 컴포넌트를 쓰기
 * 시작하면 "갤러리가 깨져서 컴포넌트를 못 보는" 순환이 생긴다. 도구는 자기 힘으로 떠야 한다.
 *
 * 이건 서드파티 의존 일반에 대한 규칙이 아니라 **순환에 대한 규칙**이다 — 소비자 것이 아닌
 * 부품은 이 고리에 들어가지 않는다(`gallery/README.md`).
 */
export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "press inline-flex items-center justify-center gap-1.5 rounded-full font-medium",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
