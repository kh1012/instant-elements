import type { ElementCategory, ElementStatus } from "instant-elements/registry";
import { cn } from "../lib/cn";

/**
 * 상태 배지 — **예외만** 표시한다.
 *
 * 상태는 `draft`(기본) · `stable`(검증됨) · `deprecated`(대체됐거나 더 안 씀) 셋이고
 * **거의 전부가 draft** 다. 기본값에 배지를 달면 모든 카드에 같은 딱지가 붙어 아무 정보도
 * 주지 못하고, 프리뷰와 색을 다툰다. 그래서 기본은 침묵하고 예외인 `stable`·`deprecated` 만
 * 말한다 — `stable`은 기존 동작 그대로 두고(이미 검증된 신호라 깰 이유가 없다), `deprecated`는
 * 더 급한 정보라 danger 톤으로 얹는다.
 *
 * _근거: 상류 하네스 StatusBadge.tsx — 같은 이유로 그쪽은 deprecated 만 표시한다._
 */
export function StatusBadge({ status, className }: { status: ElementStatus; className?: string }) {
  if (status === "draft") return null;

  const isDeprecated = status === "deprecated";
  return (
    <span
      className={cn(
        // forced-colors(고대비)에서는 배경색이 평탄화돼 pill 구분이 사라지므로 outline 으로 형태를 남긴다.
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5",
        "text-step-n2 font-medium leading-none",
        "forced-colors:outline forced-colors:outline-1",
        isDeprecated ? "bg-st-badge-danger-bg text-st-destructive" : "bg-st-badge-success-bg text-st-success",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", isDeprecated ? "bg-st-destructive" : "bg-st-success")}
      />
      {status}
    </span>
  );
}

export function CategoryBadge({
  category,
  className,
}: {
  category: ElementCategory;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-st-muted px-1.5 py-0.5 text-step-n2 text-st-muted-foreground",
        className,
      )}
    >
      {category}
    </span>
  );
}

export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-st-primary px-1.5 py-0.5 text-step-n2 font-medium text-st-primary-foreground",
        className,
      )}
    >
      new
    </span>
  );
}
