import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearIdentity, identityPath, readIdentity, resolveActorName, writeIdentity } from "./store.js";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "instant-elements-identity-"));
  process.env["IE_HOME"] = home;
});

afterEach(() => {
  delete process.env["IE_HOME"];
  rmSync(home, { recursive: true, force: true });
});

describe("identity", () => {
  it("정하기 전에는 null 이다", () => {
    expect(readIdentity()).toBeNull();
  });

  it("쓰고 나면 그대로 읽힌다", () => {
    writeIdentity({ nickname: "kh1012", provider: "github", login: "kh1012" });
    expect(readIdentity()).toEqual({ nickname: "kh1012", provider: "github", login: "kh1012" });
  });

  it("credentials.json 이 아니라 identity.json 에 쓴다 — 토큰과 섞지 않는다", () => {
    expect(identityPath()).toBe(join(home, ".instant", "identity.json"));
  });

  it("이름이 없는 신원은 없는 것으로 친다", () => {
    // 손으로 고쳤거나 옛 형식일 수 있다. 빈 이름을 그대로 통과시키면 히스토리에 빈 actor 가 남는다.
    writeIdentity({ nickname: "   ", provider: "local" });
    expect(readIdentity()).toBeNull();
  });

  it("손상된 파일은 없는 것으로 읽고 던지지 않는다", () => {
    mkdirSync(join(home, ".instant"), { recursive: true });
    writeFileSync(identityPath(), "{ 반쪽만 쓰다 만 JSON");
    expect(readIdentity()).toBeNull();
  });

  it("지우면 다시 null 이다", () => {
    writeIdentity({ nickname: "kh1012", provider: "local" });
    clearIdentity();
    expect(readIdentity()).toBeNull();
  });
});

describe("resolveActorName", () => {
  it("신원이 있으면 git 이름보다 신원이 이긴다", () => {
    writeIdentity({ nickname: "별명", provider: "local" });
    // 이 레포에는 git user.name 이 있지만, 사람이 정한 이름이 우선이어야 한다.
    expect(resolveActorName(process.cwd())).toBe("별명");
  });

  it("신원을 지우면 git 이름으로 되돌아간다", () => {
    writeIdentity({ nickname: "별명", provider: "local" });
    clearIdentity();
    // 전역 git 설정은 남아 있으므로 그쪽으로 떨어져야 한다 — 이름이 사라지면 안 된다.
    expect(resolveActorName(process.cwd())).not.toBe("별명");
    expect(resolveActorName(process.cwd())).not.toBe("");
  });
});
