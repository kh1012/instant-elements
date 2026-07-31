import { useEffect, useRef, useState } from "react";
import type { AgentEvent, AgentRun } from "instant-elements/agent";
import { useAgent } from "../lib/agent-store";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/format";
import { Composer } from "./Composer";

/**
 * 실행 로그 패널.
 *
 * 터미널 에뮬레이터(xterm 등)를 쓰지 않는다 — 갤러리는 런타임 서드파티 의존이 0이고, 우리가
 * 보여 줄 것은 커서 제어가 필요한 셸 화면이 아니라 **append-only 이벤트 목록**이다. 그래서
 * 스크롤되는 목록 하나로 충분하다.
 *
 * 스크롤은 "바닥에 붙어 있을 때만" 따라간다. 위로 올려 읽는 중에 새 줄이 와서 화면이 튀면
 * 읽던 자리를 잃는다.
 */

const STATUS_LABEL: Record<AgentRun["status"], string> = {
  running: "실행 중",
  done: "완료",
  error: "실패",
  killed: "중단됨",
};

function EventLine({ event }: { event: AgentEvent }) {
  if (event.type === "text") {
    return <p className="whitespace-pre-wrap text-step-n2">{event.text}</p>;
  }
  if (event.type === "tool_call") {
    return (
      <p className="text-step-n2 text-st-muted-foreground">
        <span className="text-st-info">{event.name}</span>
        {event.detail ? <span className="ml-1.5 break-all">{event.detail}</span> : null}
      </p>
    );
  }
  if (event.type === "error") {
    return <p className="whitespace-pre-wrap text-step-n2 text-st-destructive">{event.message}</p>;
  }
  // session·tool_result·done 은 상태 배지로 이미 드러나므로 줄을 만들지 않는다.
  return null;
}

export function RunPanel() {
  const { enabled, runs, selectedRunId, select, panelOpen, setPanelOpen, kill, continueRun } =
    useAgent();
  const logRef = useRef<HTMLDivElement | null>(null);
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const [followUp, setFollowUp] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const selected = runs.find((run) => run.id === selectedRunId) ?? null;
  const eventCount = selected?.events.length ?? 0;

  useEffect(() => {
    if (!stuckToBottom) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [eventCount, stuckToBottom, selectedRunId]);

  if (enabled !== true || !panelOpen) return null;

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-0 z-modal mx-auto max-w-4xl px-4 pb-4",
        "anim-fade-up",
      )}
    >
      <div className="flex max-h-[60vh] flex-col overflow-hidden rounded-lg border border-st-border bg-st-popover shadow-lg">
        <header className="flex items-center gap-2 border-b border-st-border px-3 py-2">
          <span className="text-step-n2 font-medium">실행</span>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {runs.length === 0 ? (
              <span className="text-step-n2 text-st-muted-foreground">아직 실행이 없습니다.</span>
            ) : (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => select(run.id)}
                  className={cn(
                    "press shrink-0 rounded-md px-2 py-1 text-step-n2",
                    run.id === selectedRunId
                      ? "bg-st-muted font-medium"
                      : "text-st-muted-foreground hover:bg-st-button-ghost-hover-bg",
                  )}
                >
                  {run.label}
                  <span
                    className={cn(
                      "ml-1.5",
                      run.status === "running"
                        ? "text-st-info"
                        : run.status === "error"
                          ? "text-st-destructive"
                          : "text-st-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[run.status]}
                  </span>
                </button>
              ))
            )}
          </div>
          {selected?.status === "running" ? (
            <button
              type="button"
              onClick={() => void kill(selected.id)}
              className="press shrink-0 rounded-md px-2 py-1 text-step-n2 text-st-destructive hover:bg-st-button-destructive-bg"
            >
              중단
            </button>
          ) : null}
          <button
            type="button"
            aria-label="패널 닫기"
            onClick={() => setPanelOpen(false)}
            className="press shrink-0 rounded-md px-2 py-1 text-step-n2 text-st-muted-foreground hover:bg-st-button-ghost-hover-bg"
          >
            닫기
          </button>
        </header>

        <div
          ref={logRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            // 1px 여유 — 브라우저마다 소수점 반올림이 달라 정확히 0이 안 되는 경우가 있다.
            setStuckToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
          }}
          className="flex-1 overflow-y-auto px-3 py-2 font-mono"
        >
          {!selected ? (
            <p className="py-6 text-center text-step-n2 text-st-muted-foreground">
              실행을 선택하세요.
            </p>
          ) : selected.events.length === 0 ? (
            <p className="py-6 text-center text-step-n2 text-st-muted-foreground">
              기다리는 중…
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {selected.events.map((event, index) => (
                // eslint-disable-next-line react/no-array-index-key -- append-only 라 인덱스가 안정적이다.
                <EventLine key={index} event={event} />
              ))}
            </div>
          )}
        </div>

        {selected ? (
          <footer className="border-t border-st-border px-3 py-2">
            {/*
              끝난 실행에는 이어달릴 입력창을 준다 — 한 번 시키고 끝나는 게 아니라 "대화"가 되는
              지점이다. 실행 중에는 입력창을 숨긴다: 큐잉해 두는 것보다 끝나고 결과를 보고 다음
              말을 정하는 편이 실제 작업 순서에 맞는다.
            */}
            {selected.status === "running" ? (
              <p className="text-step-n2 text-st-muted-foreground">
                {STATUS_LABEL[selected.status]} · 시작 {relativeTime(selected.startedAt)}
                {selected.contextHref ? ` · ${selected.contextHref}` : ""}
              </p>
            ) : (
              <>
                <Composer
                  value={followUp}
                  onChange={setFollowUp}
                  onSubmit={() => {
                    setFollowUpError(null);
                    void continueRun(selected.id, followUp)
                      .then(() => setFollowUp(""))
                      .catch((err: unknown) =>
                        setFollowUpError(err instanceof Error ? err.message : String(err)),
                      );
                  }}
                  placeholder={
                    selected.sessionId ? "이어서 요청하기…" : "이어달릴 세션이 없습니다"
                  }
                  disabled={!selected.sessionId}
                  submitLabel="이어서"
                  maxRows={5}
                />
                {followUpError ? (
                  <p className="mt-1.5 text-step-n2 text-st-destructive">{followUpError}</p>
                ) : null}
              </>
            )}
          </footer>
        ) : null}
      </div>
    </aside>
  );
}
