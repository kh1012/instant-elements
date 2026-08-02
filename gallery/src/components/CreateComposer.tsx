import { useRef, useState } from "react";
import galleryConfig from "virtual:ie/config";
import { useAgent } from "../lib/agent-store";
import { buildCreatePrompt, type PromptContext } from "../lib/prompt";
import { cn } from "../lib/cn";
import { Composer } from "./Composer";
import { CopyButton } from "./CopyButton";
import { Popover } from "./Popover";
import { PlusIcon } from "./icons";
import { Tooltip } from "./Tooltip";

/** 서버가 동시에 돌리는 실행 한도(`src/agent/run-store.ts`)와 같아야 한다. */
const MAX_CONCURRENT = 4;

/** 라이브러리에서 시작한 생성은 특정 컴포넌트에 속하지 않는다 — 목록 화면 자체를 맥락으로 삼는다. */
const CONTEXT_HREF = "/";

/**
 * "컴포넌트를 프롬프트로 즉시 생성하기".
 *
 * 지금까지 갤러리에서 컴포넌트를 **만들 수 있는 길이 없었다.** 목록은 이미 있는 것을 보여 주기만
 * 하고, 새로 만들려면 터미널로 나가 `ie element new` 를 치고 돌아와야 했다. 찾으러 왔다가 없다는
 * 걸 알게 되는 자리가 바로 여기인데, 그 자리에서 만들 수 없으면 흐름이 끊긴다.
 *
 * ── 왜 상시 입력창이 아니라 팝오버인가
 * 목록 화면의 주인공은 목록이다. 늘 펼쳐진 입력창을 히어로 아래 두면 스크롤 한 번 분량을
 * 차지하면서, 정작 쓰는 빈도는 훨씬 낮다. 버튼 하나로 접어 두고 필요할 때 띄운다.
 */
export function CreateComposer() {
  const { enabled, runs, start, setPanelOpen } = useAgent();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  const running = runs.filter((run) => run.status === "running").length;
  const full = running >= MAX_CONCURRENT;

  const ctx: PromptContext = {
    importAlias: galleryConfig.importAlias,
    baseUrl: `http://${galleryConfig.host}:${galleryConfig.port}`,
  };
  const prompt = buildCreatePrompt(text || "(여기에 적으세요)", ctx);

  const submit = () => {
    const request = text.trim();
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    void start({ label: "새 컴포넌트", prompt: buildCreatePrompt(request, ctx), contextHref: CONTEXT_HREF })
      .then((id) => {
        if (!id) return;
        setText("");
        setOpen(false);
        // 실행을 시작했으면 로그를 열어 준다 — 눌렀는데 아무 변화가 없으면 안 눌린 줄 안다.
        setPanelOpen(true);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  /*
   * 에이전트가 꺼져 있어도 **버튼은 남긴다.** 그때는 실행 대신 프롬프트를 복사해 밖의 LLM 에
   * 붙여넣는 동선이 된다 — `--agent` 없이 쓰는 사람에게도 "여기서 만들 수 있다"는 사실은 같다.
   */
  const label = enabled ? "컴포넌트를 프롬프트로 즉시 생성하기" : "새 컴포넌트 프롬프트 만들기";

  return (
    <div className="mt-6 flex justify-center">
      <div className="relative">
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            "press inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-step-n1 font-medium",
            "bg-st-primary text-st-primary-foreground hover:opacity-90",
          )}
        >
          <PlusIcon />
          {label}
        </button>

        {/* 돌고 있는 개수. 팝오버를 닫아 둬도 "지금 몇 개가 만들어지는 중"인지는 보여야 한다. */}
        {running > 0 ? (
          <Tooltip content={`${running}건 실행 중`}>
            <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-st-destructive text-[0.625rem] font-medium text-st-destructive-foreground">
              {running > 9 ? "9+" : running}
            </span>
          </Tooltip>
        ) : null}
      </div>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        align="center"
        label="새 컴포넌트 만들기"
      >
        <div className="w-[min(36rem,calc(100vw-2rem))] p-3">
          <Composer
            value={text}
            onChange={setText}
            onSubmit={submit}
            placeholder="어떤 컴포넌트가 필요한가요? 역할로 적어 주세요 — 예: 숫자 하나와 증감률을 함께 보여주는 카드"
            disabled={!enabled || full}
            busy={busy}
            submitLabel="생성"
            maxRows={5}
          />

          <div className="mt-2 flex items-center gap-2 text-step-n2 text-st-muted-foreground">
            {full ? (
              <span className="text-st-destructive">
                동시에 {MAX_CONCURRENT}건까지만 돌릴 수 있습니다. 하나가 끝나면 다시 눌러 주세요.
              </span>
            ) : enabled ? (
              <span>비슷한 컴포넌트가 이미 있으면 새로 만들지 않고 알려 줍니다.</span>
            ) : (
              <span>
                실행은 <code>ie gallery --agent</code> 에서만 됩니다. 지금은 프롬프트 복사만
                가능합니다.
              </span>
            )}
            {/* 실행이 안 되는 상황에도 밖으로 나가는 길은 열어 둔다. */}
            <span className="ml-auto shrink-0">
              <CopyButton text={prompt} label="프롬프트 복사" size="sm" />
            </span>
          </div>

          {error ? <p className="mt-2 text-step-n2 text-st-destructive">{error}</p> : null}
        </div>
      </Popover>
    </div>
  );
}
