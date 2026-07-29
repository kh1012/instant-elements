import { elementPaths, type RegistryDirs } from "./paths.js";
import { appendLine, readJsonl } from "./io.js";
import { isHistoryAction, type HistoryEvent } from "./schema.js";

/**
 * 히스토리 사이드카 읽기·쓰기.
 *
 * 이벤트 **타입**은 `schema.ts` 에 있다 — 갤러리(브라우저)가 그 타입만 참조하고 이 파일의
 * node 의존은 안 끌고 가도록 계약과 구현을 갈라 둔다.
 */
export type { HistoryAction, HistoryEvent } from "./schema.js";
export { HISTORY_ACTIONS, isHistoryAction } from "./schema.js";

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
