import { useEffect, useRef, useState } from "react";
import { useAgent } from "../lib/agent-store";
import { cn } from "../lib/cn";
import { hasMod, SHORTCUTS } from "../lib/shortcuts";
import { TerminalIcon } from "./icons";
import { Tooltip } from "./Tooltip";

/** 완료 표시가 반짝이는 시간. 눈에 띄되 오래 남아 잔소리가 되지 않는 선. */
const FLASH_MS = 1400;

/**
 * 헤더의 실행 로그 손잡이.
 *
 * 지금까지 `RunPanel` 을 여는 길은 상세 화면에서 실행을 시작하는 것뿐이었다. 패널을 한 번 닫으면
 * 돌던 실행을 다시 볼 방법이 없었다 — 헤더에 상시 손잡이가 있어야 하는 이유다.
 *
 * 에이전트가 꺼져 있으면(`ie gallery` 를 `--agent` 없이 띄움) 아예 그리지 않는다. 눌러도 아무
 * 일이 없는 버튼은 고장으로 읽힌다.
 */
export function AgentNav() {
  const { enabled, runs, panelOpen, setPanelOpen } = useAgent();
  const running = runs.filter((run) => run.status === "running").length;
  const [flash, setFlash] = useState(false);
  const previousRunning = useRef(running);

  /*
   * 돌던 게 0 이 되는 순간에만 반짝인다. 패널을 닫아 둔 채 다른 화면을 보고 있어도 "끝났다"가
   * 눈에 들어와야 한다 — 그러라고 백그라운드로 돌리는 것이다.
   */
  useEffect(() => {
    const finished = previousRunning.current > 0 && running === 0;
    previousRunning.current = running;
    if (!finished) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), FLASH_MS);
    return () => clearTimeout(timer);
  }, [running]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!hasMod(event) || !event.shiftKey || event.key.toLowerCase() !== "a") return;
      event.preventDefault();
      setPanelOpen(!panelOpen);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, panelOpen, setPanelOpen]);

  if (!enabled) return null;

  const label = running > 0 ? `실행 중 ${running}건` : "실행 로그";

  return (
    <Tooltip
      content={
        <span className="flex items-center gap-1.5">
          {label}
          <kbd className="rounded border border-st-border px-1 py-0.5 leading-none">
            {SHORTCUTS.runPanel.keys}
          </kbd>
        </span>
      }
    >
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        aria-label={`${label} (${SHORTCUTS.runPanel.keys})`}
        aria-keyshortcuts={SHORTCUTS.runPanel.aria}
        aria-pressed={panelOpen}
        className={cn(
          "press relative grid size-8 shrink-0 place-items-center rounded-lg",
          panelOpen
            ? "bg-st-muted text-st-foreground"
            : "text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground",
          flash ? "text-st-success" : "",
        )}
      >
        <TerminalIcon />
        {running > 0 || flash ? (
          <span
            aria-hidden
            className={cn(
              "absolute right-1 top-1 size-1.5 rounded-full",
              running > 0 ? "anim-status-pulse bg-st-success" : "bg-st-muted-foreground",
            )}
          />
        ) : null}
      </button>
    </Tooltip>
  );
}
