import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { credentialsPath, readCredentials, writeCredentials } from "./credentials.js";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "instant-elements-home-"));
  process.env["IE_HOME"] = home;
});

afterEach(() => {
  delete process.env["IE_HOME"];
  rmSync(home, { recursive: true, force: true });
});

describe("credentials", () => {
  it("로그인 전에는 null 을 돌려준다", () => {
    expect(readCredentials()).toBeNull();
  });

  it("쓰고 나면 그대로 읽힌다", () => {
    writeCredentials({ githubLogin: "kh1012", token: "gho_test" });
    expect(readCredentials()).toEqual({ githubLogin: "kh1012", token: "gho_test" });
  });

  it("IE_HOME 아래 .instant/credentials.json 에 쓴다", () => {
    writeCredentials({ githubLogin: "kh1012", token: "gho_test" });
    const path = credentialsPath();
    expect(path).toBe(join(home, ".instant", "credentials.json"));
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ githubLogin: "kh1012", token: "gho_test" });
  });

  it("토큰이 담기니 파일 권한을 0600 으로 좁힌다", () => {
    writeCredentials({ githubLogin: "kh1012", token: "gho_test" });
    const mode = statSync(credentialsPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
