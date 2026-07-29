import type { ElementCategory, ElementStatus } from "instant-elements/registry";
import { cn } from "../lib/cn";

const STATUS_CLASS: Record<ElementStatus, string> = {
  draft: "bg-st-badge-info-bg text-st-info",
  stable: "bg-st-badge-success-bg text-st-success",
};

export function StatusBadge({ status, className }: { status: ElementStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-step-n2 font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
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
