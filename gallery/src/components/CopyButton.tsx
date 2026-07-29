import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./Button";

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
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
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

  return (
    <Button variant={variant} size={size} className={className} onClick={copy}>
      {state === "copied" ? copiedLabel : state === "failed" ? "복사 실패" : label}
    </Button>
  );
}
