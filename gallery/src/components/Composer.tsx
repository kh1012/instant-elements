import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

/**
 * 요청 입력창.
 *
 * 높이가 내용에 따라 자란다 — 한 줄짜리 요청이 대부분이지만 가끔 문단을 쓰고, 그때 스크롤바가
 * 생기면 방금 쓴 문장이 안 보인다. 상한을 두어 화면을 다 먹지는 않게 한다.
 *
 * ⌘/Ctrl+Enter 로 보낸다. Enter 를 그대로 전송으로 쓰면 줄바꿈을 못 하는데, 요청에는 줄바꿈이
 * 자주 필요하다(예: 항목 나열).
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  busy,
  submitLabel = "실행",
  maxRows = 8,
}: {
  value: string;
  onChange(next: string): void;
  onSubmit(): void;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  submitLabel?: string;
  maxRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  // 한 줄 높이를 실측해 상한을 잡는다 — 폰트·행간이 토큰으로 바뀌어도 따라간다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight || "20");
    if (Number.isFinite(lineHeight)) setMaxHeight(lineHeight * maxRows);
  }, [maxRows]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 줄이려면 먼저 0으로 리셋해야 scrollHeight 가 실제 내용 높이를 돌려준다.
    el.style.height = "auto";
    const next = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight;
    el.style.height = `${next}px`;
    el.style.overflowY = maxHeight && el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, maxHeight]);

  const canSubmit = !disabled && !busy && value.trim() !== "";

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-lg border border-st-border bg-st-card p-2",
        "focus-within:border-st-ring",
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className={cn(
          "flex-1 resize-none bg-transparent px-1.5 py-1 text-step-n1 outline-none",
          "placeholder:text-st-muted-foreground disabled:opacity-50",
        )}
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className={cn(
          "press shrink-0 rounded-md px-3 py-1.5 text-step-n2 font-medium",
          canSubmit
            ? "bg-st-primary text-st-primary-foreground"
            : "cursor-not-allowed bg-st-muted text-st-muted-foreground",
        )}
      >
        {busy ? "실행 중…" : submitLabel}
      </button>
    </div>
  );
}
