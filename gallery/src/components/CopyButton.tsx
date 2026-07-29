import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

/**
 * 클립보드 복사 + 결과 피드백.
 *
 * 갤러리에서 가장 많이 눌리는 버튼이다 — 프롬프트를 복사해 에이전트 세션에 붙이는 것이
 * 이 도구의 주 동선이라서. 그래서 성공·실패를 반드시 눈에 보이게 알린다.
 * `navigator.clipboard` 는 보안 컨텍스트에서만 동작하므로(127.0.0.1 은 허용) 실패도 다룬다.
 */
export function CopyButton({
  text,
  label = "복사",
  copiedLabel = "복사됨",
  variant = "outline",
  size = "md",
  className,
  icon,
  tooltip,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
  /** 주면 라벨 대신 아이콘만 그린다. 라벨은 접근성 이름으로 남는다. */
  icon?: ReactNode;
  /** 아이콘만 그릴 때의 설명. **이름이 아니라 용도**를 적는다. */
  tooltip?: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  }, [text]);

  if (icon) {
    // 아이콘만 그릴 때는 복사 결과를 글자로 못 알린다 — 표면 색으로 짧게 신호한다.
    const button = (
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label}
        className={cn(
          "press inline-flex h-9 w-9 items-center justify-center rounded-md",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring",
          state === "copied"
            ? "bg-st-badge-success-bg text-st-success"
            : state === "failed"
              ? "bg-st-badge-danger-bg text-st-destructive"
              : "hover:bg-st-button-ghost-hover-bg",
          className,
        )}
      >
        {icon}
      </button>
    );
    return tooltip ? (
      <Tooltip content={state === "copied" ? copiedLabel : tooltip}>{button}</Tooltip>
    ) : (
      button
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={copy}>
      {state === "copied" ? copiedLabel : state === "failed" ? "복사 실패" : label}
    </Button>
  );
}
