import { elementPaths, type RegistryDirs } from "./paths.js";
import { appendLine, readJsonl } from "./io.js";

/**
 * 히스토리 이벤트 — "무엇이 언제 왜 일어났나"의 append-only 기록.
 *
 * - `created`     최초 생성. 요청 원문이 `prompt` 에 그대로 남는다.
 * - `modified`    코드를 실제로 고쳤을 때. `sha` 가 있으면 그 커밋이 곧 복원 지점이다.
 * - `recommended` 신규 생성 대신 기존 컴포넌트를 추천했을 때. 코드는 안 바뀌지만 **이것만은 남긴다** —
 *                 없으면 하네스의 존재 이유인 재사용률을 영영 잴 수 없다.
 */
export type HistoryAction = "created" | "modified" | "recommended";

export const HISTORY_ACTIONS: HistoryAction[] = ["created", "modified", "recommended"];

export interface HistoryEvent {
  /** ISO 8601. 실제 시각이어야 한다. */
  at: string;
  /** git user.name (없으면 "unknown"). */
  actor: string;
  action: HistoryAction;
  /** 요청 원문. 개행·코드펜스·URL 을 그대로 보존한다. */
  prompt?: string;
  /** 무엇을 했는지 한 줄 요약. */
  note?: string;
  /** 이 변경의 코드 커밋 SHA. 갤러리 "복원"이 가리키는 지점. */
  sha?: string;
}

export function isHistoryAction(value: unknown): value is HistoryAction {
  return typeof value === "string" && (HISTORY_ACTIONS as string[]).includes(value);
}

export function appendHistory(dirs: RegistryDirs, name: string, event: HistoryEvent): void {
  appendLine(elementPaths(dirs, name).history, JSON.stringify(event));
}

/**
 * 이벤트를 최신순으로 읽는다.
 *
 * append 순서가 곧 인과 순서라, 타임스탬프가 같아도 reverse 만으로 올바른 최신순이 된다
 * (같은 초에 두 이벤트가 쌓여도 뒤집히지 않는다).
 */
export function readHistory(dirs: RegistryDirs, name: string): HistoryEvent[] {
  const raw = readJsonl<Record<string, unknown>>(elementPaths(dirs, name).history);
  const out: HistoryEvent[] = [];
  for (const item of raw) {
    if (typeof item["at"] !== "string" || typeof item["actor"] !== "string") continue;
    if (!isHistoryAction(item["action"])) continue;
    const event: HistoryEvent = {
      at: item["at"],
      actor: item["actor"],
      action: item["action"],
    };
    if (typeof item["prompt"] === "string") event.prompt = item["prompt"];
    if (typeof item["note"] === "string") event.note = item["note"];
    if (typeof item["sha"] === "string") event.sha = item["sha"];
    out.push(event);
  }
  return out.reverse();
}
