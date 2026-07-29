import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * 프리뷰 스테이지.
 *
 * 배경을 중립(`st-background`)으로 둔다 — 여기를 물들이면 안에 놓인 컴포넌트의 **실제 색**을
 * 판단할 수 없게 된다. 갤러리 크롬은 자유롭게 꾸며도 이 안쪽만은 중립을 지킨다.
 *
 * `preview-surface` 는 **제품 실제 색을 되살리는 스코프**다 — 갤러리 크롬은 모노톤이지만
 * 이 안에서만 강조 계열이 원래 팔레트로 돌아온다(styles.css 주석 참고).
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
        "preview-surface flex items-center justify-center overflow-hidden rounded-lg border border-st-border bg-st-background p-6",
        minHeight,
        className,
      )}
    >
      {children}
    </div>
  );
}
