import { useState } from "react";
import { useAgent } from "../lib/agent-store";
import { cn } from "../lib/cn";
import { WandIcon } from "./icons";

/**
 * "지금 실행" — 이미 완성된 프롬프트를 그 자리에서 에이전트에게 보낸다.
 *
 * 요청을 더 받지 않는 경우(페이지 피드백처럼 모아 둔 내용이 곧 요청인 경우)를 위한 버튼이다.
 * 사람이 요청을 적어야 하는 곳은 입력창이 필요하므로 `DetailRunControl` 을 쓴다.
 *
 * 복사 버튼을 대체하지 않고 **옆에 선다** — 에이전트를 안 켠 사람에게는 복사가 유일한 길이다.
 */
export function RunNowButton({
  label,
  prompt,
  contextHref,
  children,
}: {
  label: string;
  prompt: string;
  contextHref: string;
  children: React.ReactNode;
}) {
  const { enabled, start, runningFor, setPanelOpen } = useAgent();
  const [error, setError] = useState<string | null>(null);

  if (enabled !== true) return null;

  const running = runningFor(contextHref);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          if (running) return setPanelOpen(true);
          setError(null);
          void start({ label, prompt, contextHref }).catch((err: unknown) =>
            setError(err instanceof Error ? err.message : String(err)),
          );
        }}
        className={cn(
          "press inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3",
          "text-step-n2 font-medium",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring",
          running
            ? "bg-st-muted text-st-muted-foreground"
            : "bg-st-primary text-st-primary-foreground",
        )}
      >
        <WandIcon />
        {running ? "실행 중" : children}
      </button>
      {error ? <p className="text-step-n2 text-st-destructive">{error}</p> : null}
    </div>
  );
}
