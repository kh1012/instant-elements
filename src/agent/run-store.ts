import type { ChildProcess } from "node:child_process";
import spawn from "cross-spawn";
import { claudeAdapter } from "./claude-adapter.js";
import { createLineBuffer } from "./line-buffer.js";
import type { AgentEvent, AgentRun, RunStatus } from "./types.js";

/**
 * 실행 중인 에이전트들의 저장소.
 *
 * **영속화하지 않는다.** dev 서버가 살아 있는 동안만 메모리에 둔다 — 실제 산출물(코드 변경과
 * `ie element log` 히스토리)은 이미 디스크에 남으므로, 실행 로그까지 파일로 관리하면 지우는
 * 책임만 새로 생긴다. 필요해지면 `.instant/runs/` 에 JSONL 로 붙이는 게 자연스러운 확장점이다.
 *
 * 상한 두 개로 무한 성장을 막는다: 실행 하나의 이벤트 수, 끝난 실행의 보관 개수.
 */

const MAX_EVENTS_PER_RUN = 500;
const MAX_FINISHED_RUNS = 20;
/** 동시에 띄울 수 있는 프로세스 수. 에이전트 하나가 CPU·토큰을 꽤 먹어 넉넉히 잡지 않는다. */
const MAX_CONCURRENT_RUNS = 4;

interface LiveRun {
  run: AgentRun;
  child: ChildProcess | null;
}

/** 이벤트가 생길 때마다 불린다. SSE 가 이걸로 클라이언트에 밀어 넣는다. */
export type RunListener = (runId: string, event: AgentEvent) => void;

export interface StartRunInput {
  label: string;
  prompt: string;
  contextHref: string;
  /** 이어달리기 — 이 실행의 CLI 세션을 물려받는다. */
  sessionId?: string;
}

export class AgentRunStore {
  private readonly runs = new Map<string, LiveRun>();
  private readonly listeners = new Set<RunListener>();
  private counter = 0;

  constructor(private readonly cwd: string) {}

  subscribe(listener: RunListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): AgentRun[] {
    return [...this.runs.values()].map((live) => live.run);
  }

  get(runId: string): AgentRun | null {
    return this.runs.get(runId)?.run ?? null;
  }

  /** 같은 대상에서 이미 돌고 있는 실행. 중복 실행을 막는 근거다. */
  runningFor(contextHref: string): AgentRun | null {
    for (const { run } of this.runs.values()) {
      if (run.status === "running" && run.contextHref === contextHref) return run;
    }
    return null;
  }

  private get runningCount(): number {
    return [...this.runs.values()].filter((l) => l.run.status === "running").length;
  }

  start(input: StartRunInput): { ok: true; run: AgentRun } | { ok: false; reason: string } {
    if (this.runningCount >= MAX_CONCURRENT_RUNS) {
      return { ok: false, reason: `동시에 ${MAX_CONCURRENT_RUNS}개까지만 실행할 수 있습니다.` };
    }
    const existing = this.runningFor(input.contextHref);
    if (existing) {
      return { ok: false, reason: "이미 실행 중입니다 — 끝나면 다시 요청하세요." };
    }

    this.counter += 1;
    const id = `run-${Date.now().toString(36)}-${this.counter}`;
    const run: AgentRun = {
      id,
      label: input.label,
      status: "running",
      contextHref: input.contextHref,
      startedAt: new Date().toISOString(),
      events: [],
    };

    const args = claudeAdapter.buildSpawnArgs({
      prompt: input.prompt,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    });

    let child: ChildProcess;
    try {
      // cross-spawn 을 쓰는 이유: Windows 에서 npm 전역 `claude` 는 `.cmd` shim 이라 Node 기본
      // spawn 이 ENOENT 로 실패한다. `shell: true` 로 우회하면 프롬프트가 셸 메타문자로 해석될
      // 수 있어(인젝션) 절대 안 되고, cross-spawn 이 그 케이스만 안전하게 처리해 준다.
      // 셸을 거치지 않으므로 프롬프트에 무엇이 있든 인자 하나로만 전달된다.
      child = spawn(claudeAdapter.command, args, { cwd: this.cwd, stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      return { ok: false, reason: `에이전트를 띄우지 못했습니다: ${String(err)}` };
    }

    const live: LiveRun = { run, child };
    this.runs.set(id, live);
    this.prune();

    const buffer = createLineBuffer();
    const consume = (chunk: Buffer): void => {
      for (const line of buffer.push(chunk.toString())) {
        for (const event of claudeAdapter.normalizeLine(line)) this.append(live, event);
      }
    };

    child.stdout?.on("data", consume);
    // stderr 은 정규화 대상이 아니다 — CLI 가 사람에게 하는 말이라 그대로 흘린다.
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) this.append(live, { type: "text", text });
    });

    child.on("error", (err) => {
      this.append(live, {
        type: "error",
        message:
          (err as NodeJS.ErrnoException).code === "ENOENT"
            ? `\`${claudeAdapter.command}\` 를 찾지 못했습니다 — 설치돼 있고 PATH 에 있는지 확인하세요.`
            : err.message,
      });
      this.finish(live, "error");
    });

    child.on("close", (code) => {
      for (const line of buffer.flush()) {
        for (const event of claudeAdapter.normalizeLine(line)) this.append(live, event);
      }
      if (live.run.status !== "running") return; // kill 이 이미 상태를 정했다.
      this.finish(live, code === 0 ? "done" : "error");
    });

    return { ok: true, run };
  }

  /** SIGTERM 으로 정중히 요청하고, 5초 뒤에도 살아 있으면 SIGKILL. */
  kill(runId: string): boolean {
    const live = this.runs.get(runId);
    if (!live || live.run.status !== "running") return false;

    const child = live.child;
    this.finish(live, "killed");
    if (child && !child.killed) {
      child.kill("SIGTERM");
      const timer = setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5_000);
      // dev 서버가 이 타이머 때문에 종료를 못 하는 일이 없게.
      timer.unref?.();
    }
    return true;
  }

  /** dev 서버가 내려갈 때 고아 프로세스를 남기지 않는다. */
  killAll(): void {
    for (const [id] of this.runs) this.kill(id);
  }

  private append(live: LiveRun, event: AgentEvent): void {
    if (event.type === "session") {
      live.run.sessionId = event.sessionId;
    }
    live.run.events.push(event);
    if (live.run.events.length > MAX_EVENTS_PER_RUN) {
      live.run.events.splice(0, live.run.events.length - MAX_EVENTS_PER_RUN);
    }
    for (const listener of this.listeners) listener(live.run.id, event);
  }

  private finish(live: LiveRun, status: RunStatus): void {
    live.run.status = status;
    live.run.endedAt = new Date().toISOString();
    live.child = null;
    this.prune();
  }

  /** 끝난 실행이 쌓이면 오래된 것부터 버린다. 돌고 있는 것은 절대 건드리지 않는다. */
  private prune(): void {
    const finished = [...this.runs.values()]
      .filter((l) => l.run.status !== "running")
      .sort((a, b) => (a.run.endedAt ?? "").localeCompare(b.run.endedAt ?? ""));
    for (const live of finished.slice(0, Math.max(0, finished.length - MAX_FINISHED_RUNS))) {
      this.runs.delete(live.run.id);
    }
  }
}
