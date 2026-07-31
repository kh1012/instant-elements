import { useState } from "react";
import type { Entry } from "instant-elements/registry";
import { Composer } from "../components/Composer";
import { SplitIcon, WandIcon } from "../components/icons";
import { Tooltip } from "../components/Tooltip";
import { useAgent } from "../lib/agent-store";
import { cn } from "../lib/cn";
import { buildModifyPrompt, buildSplitPrompt, type PromptContext } from "../lib/prompt";

/**
 * "여기서 바로 고치기" — 수정 프롬프트를 복사해 밖으로 들고 나가는 대신 그 자리에서 에이전트에게 보낸다.
 *
 * 복사 버튼을 대체하지 않는다. 채널이 생겨도 "쓰던 LLM 창에 붙여넣기"는 여전히 유효한 동선이고,
 * 무엇보다 `ie gallery --agent` 를 안 켠 사람에게는 복사가 유일한 길이다.
 *
 * 프롬프트는 복사 버튼과 **같은 빌더**를 쓴다(`buildModifyPrompt`). 입력한 요청이 원래 비어 있던
 * "## 요청사항" 자리를 채울 뿐이라, 두 동선이 에이전트에게 똑같은 지시를 보낸다.
 */
/** 무엇을 시킬 것인가. 프롬프트 빌더가 갈리는 유일한 축이다. */
type Mode = "modify" | "split";

export function DetailRunControl({ entry, ctx }: { entry: Entry; ctx: PromptContext }) {
  const { enabled, start, runningFor, setPanelOpen } = useAgent();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("modify");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 에이전트가 꺼진 갤러리에서는 아예 보여 주지 않는다 — 눌러도 안 되는 버튼은 없느니만 못하다.
  if (enabled !== true) return null;

  const contextHref = `/c/${entry.name}`;
  const running = runningFor(contextHref);

  const submit = (): void => {
    setError(null);
    // 분할은 "무엇을 어떻게 쪼갤지"를 프롬프트가 이미 6단계로 지시하므로 사람 입력이 없어도 성립한다.
    const prompt =
      mode === "split" ? buildSplitPrompt(entry, ctx) : buildModifyPrompt(entry, ctx, text);
    void start({ label: entry.name, prompt, contextHref })
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
          {/* 수정과 분할은 "이 컴포넌트로 무엇을 시킬 것인가"의 두 갈래다 — 복사 버튼 3종과 같은 축. */}
          <div className="mb-2 flex items-center gap-0.5 rounded-md bg-st-muted p-0.5">
            {(
              [
                { value: "modify", label: "고치기", icon: <WandIcon /> },
                { value: "split", label: "쪼개기", icon: <SplitIcon /> },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={mode === option.value}
                className={cn(
                  "press flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-step-n2",
                  mode === option.value
                    ? "bg-st-card text-st-foreground shadow-sm"
                    : "text-st-muted-foreground hover:text-st-foreground",
                )}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>

          {mode === "split" ? (
            <>
              <p className="mb-2 text-step-n2 text-st-muted-foreground">
                너무 커진 이 컴포넌트를 조각으로 쪼개 다시 조립합니다. 무엇을 어떻게 나눌지는
                에이전트가 판단하고, 아직 이르다고 보면 이유를 대고 멈춥니다.
              </p>
              <button
                type="button"
                onClick={submit}
                className="press w-full rounded-md bg-st-primary px-3 py-1.5 text-step-n2 font-medium text-st-primary-foreground"
              >
                분할 실행
              </button>
            </>
          ) : (
            <>
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
              <p className="mt-2 text-step-n2 text-st-muted-foreground">
                ⌘/Ctrl + Enter 로도 보냅니다.
              </p>
            </>
          )}
          {error ? <p className="mt-2 text-step-n2 text-st-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
