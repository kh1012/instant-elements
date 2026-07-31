/**
 * 에이전트 실행 계약.
 *
 * CLI 마다 출력 형식이 다르지만(claude 는 stream-json, codex 는 또 다른 JSON) 갤러리가 알아야
 * 하는 것은 "무슨 일이 일어났나" 뿐이다. 그래서 어댑터가 각자의 출력을 아래 7종 이벤트로
 * 정규화하고, 그 위쪽(run-store · API · UI)은 CLI 종류를 전혀 모른다.
 *
 * node 의존이 0이라 갤러리(브라우저)도 이 파일의 타입을 그대로 참조할 수 있다.
 */

/** 어느 CLI 를 쓰는가. 새 CLI 는 어댑터만 추가하면 된다. */
export type AgentId = "claude";

export const AGENT_IDS: AgentId[] = ["claude"];

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && (AGENT_IDS as string[]).includes(value);
}

/**
 * 정규화된 이벤트.
 *
 * - `session`     CLI 가 알려 준 세션 id. 이어달리기(`--resume`)에 쓴다.
 * - `text`        사람이 읽는 출력 한 덩어리.
 * - `tool_call`   에이전트가 도구를 부르기 시작했다(무엇을 하는 중인지 보여 주는 용도).
 * - `tool_result` 그 도구의 결과.
 * - `done`        정상 종료.
 * - `error`       실패. `message` 는 사람이 읽을 수 있어야 한다.
 */
export type AgentEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; detail?: string }
  | { type: "tool_result"; name: string; detail?: string }
  | { type: "done" }
  | { type: "error"; message: string };

export interface SpawnArgsInput {
  prompt: string;
  /** 이어달리기 대상 세션. 있으면 CLI 에 resume 을 건다. */
  sessionId?: string;
}

export interface AgentAdapter {
  id: AgentId;
  /** 실행 파일 이름. PATH 에서 찾는다. */
  command: string;
  buildSpawnArgs(input: SpawnArgsInput): string[];
  /**
   * stdout 한 줄을 정규화한다.
   *
   * 배열을 돌려주는 이유: 한 줄(assistant 메시지 하나)에 여러 content 블록이 들어온다 —
   * 텍스트와 도구 호출이 같은 줄에 함께 오는 게 흔하다. 해석할 수 없는 줄은 빈 배열로
   * **조용히 버린다** — CLI 가 형식을 조금 바꿔도 실행 전체가 죽지 않아야 한다.
   */
  normalizeLine(line: string): AgentEvent[];
}

export type RunStatus = "running" | "done" | "error" | "killed";

export interface AgentRun {
  id: string;
  /** 목록에 보여줄 이름. 보통 컴포넌트 이름. */
  label: string;
  status: RunStatus;
  /** 이 실행이 어느 화면에서 시작됐나(딥링크). 같은 대상 중복 실행을 막는 열쇠이기도 하다. */
  contextHref: string;
  startedAt: string;
  endedAt?: string;
  events: AgentEvent[];
  /** CLI 세션 id — 이어달리기용. */
  sessionId?: string;
}
