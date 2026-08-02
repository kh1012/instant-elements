import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * 프리뷰 스테이지.
 *
 * 배경을 중립(`st-background`)으로 둔다 — 여기를 물들이면 안에 놓인 컴포넌트의 **실제 색**을
 * 판단할 수 없게 된다. 갤러리 크롬은 자유롭게 꾸며도 이 안쪽만은 중립을 지킨다.
 */
export function DemoFrame({
  children,
  className,
  minHeight = "min-h-64",
}: {
  children: ReactNode;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg border border-st-border bg-st-background p-6",
        minHeight,
        className,
      )}
    >
      {children}
    </div>
  );
}
