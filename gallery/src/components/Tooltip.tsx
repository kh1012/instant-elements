import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * 경량 툴팁 — 의존성 0.
 *
 * 네이티브 `title` 을 쓰지 않는 이유: 표시가 브라우저마다 다르고 지연이 길며 키보드 포커스로는
 * 안 뜬다. 아이콘 버튼은 라벨이 없어 툴팁이 **유일한 설명**이라 그 편차를 감수할 수 없다.
 *
 * 내용은 **이름이 아니라 용도**를 적는다 — "수정 프롬프트 복사"라고만 하면 다른 프롬프트와
 * 무엇이 다른지 여전히 모른다.
 */
export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-tooltip w-max max-w-56 -translate-x-1/2 rounded-md",
            "border border-st-border bg-st-popover px-2 py-1 text-step-n2 text-st-popover-foreground shadow-lg",
            side === "bottom" ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
