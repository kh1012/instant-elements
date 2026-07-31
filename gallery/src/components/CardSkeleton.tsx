import { cn } from "../lib/cn";

/**
 * 목록이 도착하기 전의 뼈대.
 *
 * "불러오는 중…" 한 줄 대신 **도착할 화면의 형태**를 깐다. 글자를 두면 눈이 그걸 읽으러 갔다가
 * 사라지고 다시 실제 목록을 훑어야 하지만, 닮은 덩어리를 두면 시선이 한 번만 간다. 카드 수는
 * 첫 화면에 대개 보이는 만큼만 — 더 깔면 실제보다 많아 보였다가 줄어들어 오히려 흔들린다.
 */
export function CardSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      aria-label="불러오는 중"
      aria-live="polite"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-lg border border-st-border bg-st-card p-4"
        >
          <div className="h-28 w-full animate-pulse rounded-md bg-st-muted motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-st-muted motion-reduce:animate-none" />
          <div className="h-3 w-full animate-pulse rounded bg-st-muted motion-reduce:animate-none" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-st-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
