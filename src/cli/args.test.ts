import { describe, expect, it } from "vitest";
import { flagBool, flagList, flagString, parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("첫 non-flag 토큰을 command 로, 나머지를 positionals 로 나눈다", () => {
    const { command, positionals } = parseArgs(["element", "new", "stat-card"]);
    expect(command).toBe("element");
    expect(positionals).toEqual(["new", "stat-card"]);
  });

  it("값 없는 --flag 는 true", () => {
    expect(parseArgs(["doctor", "--json"]).flags["json"]).toBe(true);
  });

  it("--flag=value 와 --flag value 를 같게 읽는다", () => {
    expect(parseArgs(["--name=card"]).flags["name"]).toBe("card");
    expect(parseArgs(["--name", "card"]).flags["name"]).toBe("card");
  });

  it("--no-flag 는 false", () => {
    expect(parseArgs(["--no-color"]).flags["color"]).toBe(false);
  });

  it("다음 토큰이 플래그면 값으로 삼지 않는다", () => {
    const { flags } = parseArgs(["--json", "--name", "card"]);
    expect(flags["json"]).toBe(true);
    expect(flags["name"]).toBe("card");
  });

  it("음수는 값으로 본다", () => {
    expect(parseArgs(["--offset", "-3"]).flags["offset"]).toBe("-3");
  });

  it("반복 지정은 배열로 모은다", () => {
    expect(parseArgs(["--kw", "a", "--kw", "b"]).flags["kw"]).toEqual(["a", "b"]);
  });

  it("-- 이후는 전부 positional", () => {
    const { command, positionals, flags } = parseArgs(["run", "--", "--not-a-flag"]);
    expect(command).toBe("run");
    expect(positionals).toEqual(["--not-a-flag"]);
    expect(flags).toEqual({});
  });

  it("짧은 플래그도 값을 받는다", () => {
    expect(parseArgs(["-n", "card"]).flags["n"]).toBe("card");
    expect(parseArgs(["-h"]).flags["h"]).toBe(true);
  });
});

describe("flag 읽기 헬퍼", () => {
  it("flagString 은 마지막 지정이 이긴다", () => {
    const { flags } = parseArgs(["--name", "a", "--name", "b"]);
    expect(flagString(flags, "name")).toBe("b");
    expect(flagString(flags, "missing", "fallback")).toBe("fallback");
  });

  it("flagBool 은 'false'/'0'/'' 만 false 로 본다", () => {
    expect(flagBool(parseArgs(["--x"]).flags, "x")).toBe(true);
    expect(flagBool(parseArgs(["--x=false"]).flags, "x")).toBe(false);
    expect(flagBool(parseArgs(["--x=0"]).flags, "x")).toBe(false);
    expect(flagBool(parseArgs(["--x=yes"]).flags, "x")).toBe(true);
    expect(flagBool(parseArgs([]).flags, "x")).toBe(false);
  });

  it("flagList 는 반복 지정과 쉼표 구분을 함께 푼다", () => {
    const { flags } = parseArgs(["--kw", "a,b", "--kw", "c"]);
    expect(flagList(flags, "kw")).toEqual(["a", "b", "c"]);
    expect(flagList(parseArgs([]).flags, "kw")).toEqual([]);
  });
});
