import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AgentEvent, AgentRun } from "instant-elements/agent";

/**
 * 실행 상태 저장소.
 *
 * SSE 연결을 **앱 최상단에서 하나만** 유지한다. 라우트를 옮겨도 안 끊기고, 실행마다 연결을
 * 열지 않아 브라우저 동시 연결 한도를 축내지 않는다. 서버가 실행 id 를 payload 에 담아 주므로
 * 채널 하나로 충분하다.
 *
 * 에이전트가 꺼진 갤러리(`ie gallery` 를 --agent 없이 띄운 경우)에서는 연결 자체를 열지 않는다 —
 * `/api/health` 의 `agent` 플래그로 판단한다.
 */

interface AgentState {
  /** 이 갤러리가 에이전트를 띄울 수 있는가. null 이면 아직 확인 중. */
  enabled: boolean | null;
  runs: AgentRun[];
  selectedRunId: string | null;
  panelOpen: boolean;
}

interface AgentContextValue extends AgentState {
  select(runId: string | null): void;
  setPanelOpen(open: boolean): void;
  start(input: { label: string; prompt: string; contextHref: string }): Promise<string | null>;
  /** 끝난 실행에 턴을 이어붙인다 — 같은 대화의 다음 말. */
  continueRun(runId: string, prompt: string): Promise<void>;
  kill(runId: string): Promise<void>;
  /** 이 화면에서 이미 돌고 있는 실행 — 중복 실행을 막는 근거. */
  runningFor(contextHref: string): AgentRun | null;
}

const AgentContext = createContext<AgentContextValue | null>(null);

type Frame =
  | { type: "snapshot"; runs: AgentRun[] }
  | { type: "event"; runId: string; event: AgentEvent; run: AgentRun | null };

/**
 * 패널을 열어 둔 상태는 **페이지를 다시 그려도 살아남아야 한다.**
 *
 * 에이전트가 하는 일이 정확히 소비 프로젝트의 파일을 고치는 것이고, 그 순간 Vite HMR 이 돌아
 * 갤러리가 다시 마운트된다 — 즉 "일이 잘 풀릴수록 화면이 리셋된다". 실행은 서버에 살아 있어
 * 목록은 SSE 스냅샷으로 복구되지만, 열어 둔 패널까지 닫혀 버리면 진행 상황을 놓친다.
 *
 * localStorage 가 아니라 sessionStorage 인 이유: 이건 지금 보고 있는 창의 상태다. 내일 새 탭을
 * 열었을 때 지난번 패널이 열려 있을 이유는 없다.
 */
const PANEL_KEY = "ie:agent-panel";

function readPanelOpen(): boolean {
  try {
    return sessionStorage.getItem(PANEL_KEY) === "1";
  } catch {
    return false; // 사생활 보호 모드 등 — 없으면 그냥 닫힌 채로 시작한다.
  }
}

function writePanelOpen(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(PANEL_KEY, "1");
    else sessionStorage.removeItem(PANEL_KEY);
  } catch {
    /* 저장 실패는 기능을 막지 않는다 */
  }
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgentState>({
    enabled: null,
    runs: [],
    selectedRunId: null,
    panelOpen: readPanelOpen(),
  });
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((res) => res.json())
      .then((health: { agent?: boolean }) => {
        if (!cancelled) setState((s) => ({ ...s, enabled: health.agent === true }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, enabled: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.enabled !== true || sourceRef.current) return;

    const source = new EventSource("/api/agent/stream");
    sourceRef.current = source;
    source.onmessage = (message) => {
      let frame: Frame;
      try {
        frame = JSON.parse(message.data) as Frame;
      } catch {
        return;
      }
      setState((s) => applyFrame(s, frame));
    };
    // 끊기면 EventSource 가 알아서 다시 붙고, 서버가 snapshot 을 다시 보내 상태를 복구한다.

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [state.enabled]);

  const select = useCallback((runId: string | null) => {
    setState((s) => ({ ...s, selectedRunId: runId }));
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    writePanelOpen(open);
    setState((s) => ({ ...s, panelOpen: open }));
  }, []);

  const start = useCallback<AgentContextValue["start"]>(async (input) => {
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json()) as { run?: AgentRun; error?: string };
    if (!res.ok || !body.run) {
      // 실패해도 화면은 살아 있어야 한다 — 이유는 패널이 보여 준다.
      writePanelOpen(true);
      setState((s) => ({ ...s, panelOpen: true }));
      throw new Error(body.error ?? "실행을 시작하지 못했습니다.");
    }
    const run = body.run;
    writePanelOpen(true);
    setState((s) => ({
      ...s,
      runs: [...s.runs.filter((r) => r.id !== run.id), run],
      selectedRunId: run.id,
      panelOpen: true,
    }));
    return run.id;
  }, []);

  const continueRun = useCallback(async (runId: string, prompt: string) => {
    const res = await fetch(`/api/agent/continue/${encodeURIComponent(runId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "이어달리지 못했습니다.");
    }
    // 상태 갱신은 SSE 가 밀어 준다 — 여기서 낙관적으로 바꾸면 서버와 어긋날 여지만 생긴다.
  }, []);

  const kill = useCallback(async (runId: string) => {
    await fetch(`/api/agent/kill/${encodeURIComponent(runId)}`, { method: "POST" });
  }, []);

  const runningFor = useCallback<AgentContextValue["runningFor"]>(
    (contextHref) =>
      state.runs.find((run) => run.status === "running" && run.contextHref === contextHref) ?? null,
    [state.runs],
  );

  const value = useMemo<AgentContextValue>(
    () => ({ ...state, select, setPanelOpen, start, continueRun, kill, runningFor }),
    [state, select, setPanelOpen, start, continueRun, kill, runningFor],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

/** SSE 프레임 하나를 상태에 접는다. 순수 함수라 프레임 순서만 지키면 결과가 결정적이다. */
function applyFrame(state: AgentState, frame: Frame): AgentState {
  if (frame.type === "snapshot") {
    return { ...state, runs: frame.runs };
  }
  if (!frame.run) return state;
  const run = frame.run;
  const exists = state.runs.some((r) => r.id === run.id);
  return {
    ...state,
    runs: exists ? state.runs.map((r) => (r.id === run.id ? run : r)) : [...state.runs, run],
    // 아무것도 안 보고 있었으면 방금 생긴 실행을 자동으로 선택한다.
    selectedRunId: state.selectedRunId ?? run.id,
  };
}

export function useAgent(): AgentContextValue {
  const value = useContext(AgentContext);
  if (!value) throw new Error("useAgent 는 AgentProvider 안에서만 쓸 수 있습니다.");
  return value;
}
