import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * 시간 순 사건 목록.
 *
 * 카드를 세로로 쌓는 것과 무엇이 다른가 — **레일이 사건들을 하나의 흐름으로 묶는다.** 카드
 * 나열은 "관련 없는 항목 여럿"으로 읽히고, 점과 선은 "한 컴포넌트가 지나온 길"로 읽힌다.
 * 히스토리에서는 후자가 맞다.
 *
 * _근거: 상류 하네스 packages/ui/src/staging/timeline._
 */
export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col">{children}</ol>;
}

export function TimelineItem({
  tone = "muted",
  last = false,
  index = 0,
  children,
}: {
  /** 점 색. 생성처럼 시작을 뜻하는 사건만 강조한다. */
  tone?: "primary" | "muted" | "success" | "danger";
  /** 마지막 항목은 아래로 선을 잇지 않는다 — 이어질 곳이 없는데 선이 뻗으면 미완으로 보인다. */
  last?: boolean;
  index?: number;
  children: ReactNode;
}) {
  return (
    <li
      className="stagger-item relative flex gap-3 pb-5 last:pb-0"
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <div className="relative flex w-3 shrink-0 justify-center">
        <span
          aria-hidden
          className={cn(
            "relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-st-background",
            tone === "primary"
              ? "bg-st-primary"
              : tone === "success"
                ? "bg-st-success"
                : tone === "danger"
                  ? "bg-st-destructive"
                  : "bg-st-muted-foreground/50",
          )}
        />
        {!last ? (
          <span aria-hidden className="absolute inset-y-0 top-3 w-px bg-st-border" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-1">{children}</div>
    </li>
  );
}

/** 사건의 머리줄 — 언제·누가·무엇을. */
export function TimelineMeta({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 text-step-n2">{children}</div>;
}

/** 사건의 본문 — 요청 원문이나 메모. */
export function TimelineBody({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 text-step-n2 text-st-muted-foreground">{children}</div>;
}
