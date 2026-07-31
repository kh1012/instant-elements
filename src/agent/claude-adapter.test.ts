import { describe, expect, it } from "vitest";
import { claudeAdapter } from "./claude-adapter.js";

/**
 * 아래 줄들은 실제 `claude -p … --output-format=stream-json --verbose` 출력에서 따온 형태다
 * (긴 필드는 덜어냈다). 추측한 스키마가 아니라 실측이라, CLI 가 형식을 바꾸면 이 테스트가 먼저 깨진다.
 */
describe("claudeAdapter.normalizeLine", () => {
  it("init 에서 세션 id 를 잡는다 — 이어달리기의 열쇠", () => {
    const line = JSON.stringify({ type: "system", subtype: "init", session_id: "abc-123" });
    expect(claudeAdapter.normalizeLine(line)).toEqual([{ type: "session", sessionId: "abc-123" }]);
  });

  it("assistant 텍스트를 흘려보낸다", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "hi" }] },
    });
    expect(claudeAdapter.normalizeLine(line)).toEqual([{ type: "text", text: "hi" }]);
  });

  it("한 줄에 텍스트와 도구 호출이 함께 오면 둘 다 돌려준다", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "파일을 고칩니다" },
          { type: "tool_use", name: "Edit", input: { file_path: "src/elements/card/card.tsx" } },
        ],
      },
    });
    expect(claudeAdapter.normalizeLine(line)).toEqual([
      { type: "text", text: "파일을 고칩니다" },
      { type: "tool_call", name: "Edit", detail: "src/elements/card/card.tsx" },
    ]);
  });

  it("result 는 성공/실패를 가른다", () => {
    expect(claudeAdapter.normalizeLine(JSON.stringify({ type: "result", is_error: false }))).toEqual([
      { type: "done" },
    ]);
    expect(
      claudeAdapter.normalizeLine(JSON.stringify({ type: "result", is_error: true, result: "터졌습니다" })),
    ).toEqual([{ type: "error", message: "터졌습니다" }]);
  });

  it("우리가 안 쓰는 줄은 조용히 버린다 — CLI 가 형식을 늘려도 안 깨지게", () => {
    for (const raw of [
      JSON.stringify({ type: "system", subtype: "hook_started" }),
      JSON.stringify({ type: "rate_limit_event", rate_limit_info: {} }),
      "not json at all",
      "",
    ]) {
      expect(claudeAdapter.normalizeLine(raw)).toEqual([]);
    }
  });
});

describe("claudeAdapter.buildSpawnArgs", () => {
  it("셸을 거치지 않게 프롬프트를 인자 하나로 넘긴다", () => {
    const args = claudeAdapter.buildSpawnArgs({ prompt: "고쳐줘; rm -rf /" });
    // 프롬프트가 통째로 한 인자다 — 세미콜론이 있어도 셸이 해석할 기회 자체가 없다.
    expect(args[0]).toBe("-p");
    expect(args[1]).toBe("고쳐줘; rm -rf /");
  });

  it("세션 id 가 있으면 이어달린다", () => {
    expect(claudeAdapter.buildSpawnArgs({ prompt: "계속", sessionId: "s-1" })).toContain("--resume");
    expect(claudeAdapter.buildSpawnArgs({ prompt: "계속" })).not.toContain("--resume");
  });
});
