import { useState } from "react";
import type { Entry } from "instant-elements/registry";
import { Composer } from "../components/Composer";
import { WandIcon } from "../components/icons";
import { Tooltip } from "../components/Tooltip";
import { useAgent } from "../lib/agent-store";
import { cn } from "../lib/cn";
import { buildModifyPrompt, type PromptContext } from "../lib/prompt";

/**
 * "여기서 바로 고치기" — 수정 프롬프트를 복사해 밖으로 들고 나가는 대신 그 자리에서 에이전트에게 보낸다.
 *
 * 복사 버튼을 대체하지 않는다. 채널이 생겨도 "쓰던 LLM 창에 붙여넣기"는 여전히 유효한 동선이고,
 * 무엇보다 `ie gallery --agent` 를 안 켠 사람에게는 복사가 유일한 길이다.
 *
 * 프롬프트는 복사 버튼과 **같은 빌더**를 쓴다(`buildModifyPrompt`). 입력한 요청이 원래 비어 있던
 * "## 요청사항" 자리를 채울 뿐이라, 두 동선이 에이전트에게 똑같은 지시를 보낸다.
 */
export function DetailRunControl({ entry, ctx }: { entry: Entry; ctx: PromptContext }) {
  const { enabled, start, runningFor, setPanelOpen } = useAgent();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 에이전트가 꺼진 갤러리에서는 아예 보여 주지 않는다 — 눌러도 안 되는 버튼은 없느니만 못하다.
  if (enabled !== true) return null;

  const contextHref = `/c/${entry.name}`;
  const running = runningFor(contextHref);

  const submit = (): void => {
    setError(null);
    void start({ label: entry.name, prompt: buildModifyPrompt(entry, ctx, text), contextHref })
      .then(() => {
        setText("");
        setOpen(false);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="relative">
      <Tooltip content={running ? "이미 실행 중입니다" : "요청을 적어 이 자리에서 바로 고친다"}>
        <button
          type="button"
          onClick={() => (running ? setPanelOpen(true) : setOpen((v) => !v))}
          aria-expanded={open}
          className={cn(
            "press inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-step-n2 font-medium",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring",
            running
              ? "bg-st-muted text-st-muted-foreground"
              : "bg-st-primary text-st-primary-foreground",
          )}
        >
          <WandIcon />
          {running ? "실행 중" : "바로 고치기"}
        </button>
      </Tooltip>

      {open && !running ? (
        <div
          className={cn(
            "anim-fade-up absolute right-0 top-11 z-popover w-[min(28rem,calc(100vw-3rem))]",
            "rounded-lg border border-st-border bg-st-popover p-3 shadow-lg",
          )}
        >
          <p className="mb-2 text-step-n2 text-st-muted-foreground">
            무엇을 고칠까요? 나머지 지시(대상 파일·규칙·기록 절차)는 이미 붙습니다.
          </p>
          <Composer
            value={text}
            onChange={setText}
            onSubmit={submit}
            placeholder="예: 증감률을 오른쪽 정렬로, 여백을 gap-4 로"
            submitLabel="실행"
          />
          {error ? <p className="mt-2 text-step-n2 text-st-destructive">{error}</p> : null}
          <p className="mt-2 text-step-n2 text-st-muted-foreground">⌘/Ctrl + Enter 로도 보냅니다.</p>
        </div>
      ) : null}
    </div>
  );
}
