import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-st-primary text-st-primary-foreground hover:opacity-90",
  outline:
    "border border-st-button-secondary-border bg-st-button-secondary-bg hover:bg-st-button-secondary-hover-bg",
  ghost: "hover:bg-st-button-ghost-hover-bg",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-step-n2",
  md: "h-9 px-3 text-step-n1",
};

/**
 * 갤러리 크롬 전용 버튼.
 *
 * 소비 프로젝트의 컴포넌트 라이브러리에 의존하지 않는다 — 갤러리가 소비자 컴포넌트를 쓰기
 * 시작하면 "갤러리가 깨져서 컴포넌트를 못 보는" 순환이 생긴다. 도구는 자기 힘으로 떠야 한다.
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
        "press inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
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
