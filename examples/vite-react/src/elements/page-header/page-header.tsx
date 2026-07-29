import { cn } from "../_lib/cn";

export interface PageHeaderProps {
  /** 제목 줄. */
  title?: string;
  /** 제목 아래 보조 설명. */
  description?: string;
  className?: string;
}

/**
 * 화면 맨 위에 제목과 한 줄 설명을 놓는 머리말입니다.
 *
 * 색은 st-* 토큰만, 크기·여백·라운드는 스케일만 쓴다(임의 hex·[13px] 금지).
 */
export function PageHeader({
  title = "PageHeader",
  description,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-st-border bg-st-card p-4",
        "text-st-card-foreground",
        className,
      )}
    >
      <p className="text-step-1 font-semibold">{title}</p>
      {description ? <p className="text-step-n1 text-st-muted-foreground">{description}</p> : null}
    </div>
  );
}

PageHeader.displayName = "PageHeader";

// 컴포넌트 이름: page-header
