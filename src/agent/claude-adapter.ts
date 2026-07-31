import type { AgentAdapter, AgentEvent, SpawnArgsInput } from "./types.js";

/**
 * Claude Code 어댑터.
 *
 * `--output-format=stream-json --verbose` 로 띄우면 한 줄에 JSON 하나씩 흘러나온다.
 * 실제 출력을 찍어 확인한 형태를 기준으로 짰다(추측 아님) — 우리가 쓰는 줄은 넷뿐이고
 * 나머지(hook_started·rate_limit_event·usage 통계 등)는 전부 버린다.
 *
 * ⚠ `--permission-mode bypassPermissions`
 * 수정 프롬프트는 파일 편집뿐 아니라 `ie element log` · `git rev-parse`(bash)까지 요구한다.
 * 권한을 낮추면 TTY 가 없는 이 실행에서 승인 프롬프트를 아무도 답할 수 없어 흐름이 중간에
 * 멈춘다. 그래서 권한 완화가 아니라 **기능 자체를 옵트인으로 막는 방식**을 택했다
 * (`gallery.agent`, 기본 꺼짐 — src/config/types.ts 참고).
 */

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

/** 도구 인자에서 사람이 알아볼 한 줄을 뽑는다. 무엇을 하는 중인지 보이는 게 목적이라 짧게. */
function describeToolInput(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const record = input as Record<string, unknown>;
  for (const key of ["file_path", "command", "pattern", "path", "url", "description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.length > 200 ? `${value.slice(0, 200)}…` : value;
    }
  }
  return undefined;
}

function blocksOf(message: unknown): ContentBlock[] {
  if (typeof message !== "object" || message === null) return [];
  const content = (message as { content?: unknown }).content;
  return Array.isArray(content) ? (content as ContentBlock[]) : [];
}

export const claudeAdapter: AgentAdapter = {
  id: "claude",
  command: "claude",

  buildSpawnArgs({ prompt, sessionId }: SpawnArgsInput): string[] {
    // 셸을 거치지 않고 배열 인자로만 넘긴다 — 프롬프트에 무엇이 들어 있든 인젝션이 성립하지 않는다.
    const args = ["-p", prompt, "--output-format=stream-json", "--verbose"];
    if (sessionId) args.push("--resume", sessionId);
    args.push("--permission-mode", "bypassPermissions");
    return args;
  },

  normalizeLine(line: string): AgentEvent[] {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return [];
    }

    const type = parsed["type"];

    // 세션 id 는 init 에서 처음 나온다 — 이어달리기의 열쇠라 이것만 따로 잡는다.
    if (type === "system" && parsed["subtype"] === "init") {
      const sessionId = parsed["session_id"];
      return typeof sessionId === "string" ? [{ type: "session", sessionId }] : [];
    }

    if (type === "assistant") {
      const events: AgentEvent[] = [];
      for (const block of blocksOf(parsed["message"])) {
        if (block.type === "text" && typeof block.text === "string" && block.text.trim() !== "") {
          events.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use" && typeof block.name === "string") {
          const detail = describeToolInput(block.input);
          events.push({ type: "tool_call", name: block.name, ...(detail ? { detail } : {}) });
        }
      }
      return events;
    }

    if (type === "user") {
      // 도구 결과는 "무엇이 끝났다"는 신호로만 쓴다 — 본문은 대개 길고 화면에서 소음이 된다.
      const hasToolResult = blocksOf(parsed["message"]).some((b) => b.type === "tool_result");
      return hasToolResult ? [{ type: "tool_result", name: "tool" }] : [];
    }

    if (type === "result") {
      if (parsed["is_error"] === true) {
        const message = parsed["result"];
        return [{ type: "error", message: typeof message === "string" ? message : "실행에 실패했습니다." }];
      }
      return [{ type: "done" }];
    }

    return [];
  },
};
