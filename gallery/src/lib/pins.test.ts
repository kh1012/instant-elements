import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPins, isPinned, partitionByPin, togglePin } from "./pins";

/** localStorage 와 window 이벤트를 최소한으로 흉내 낸다 — jsdom 을 들이지 않기 위함. */
function installBrowserStubs(store: Map<string, string>): void {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  vi.stubGlobal("window", { dispatchEvent: () => true });
}

describe("핀 저장", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    installBrowserStubs(store);
  });

  it("토글로 켜고 끈다", () => {
    expect(isPinned("stat-card")).toBe(false);
    expect(togglePin("stat-card")).toBe(true);
    expect(isPinned("stat-card")).toBe(true);
    expect(togglePin("stat-card")).toBe(false);
    expect(isPinned("stat-card")).toBe(false);
  });

  it("새로 고정한 것이 맨 앞에 온다 — 최근 고정이 위로", () => {
    togglePin("a");
    togglePin("b");
    togglePin("c");
    expect(getPins()).toEqual(["c", "b", "a"]);
  });

  it("저장소가 깨져 있으면 핀이 없는 것으로 보고 계속 동작한다", () => {
    store.set("instant-elements-pins", "{ 깨진 JSON");
    expect(getPins()).toEqual([]);
    expect(() => togglePin("a")).not.toThrow();
  });

  it("문자열이 아닌 값이 섞여 있으면 걸러낸다", () => {
    store.set("instant-elements-pins", JSON.stringify(["a", 3, null, "b"]));
    expect(getPins()).toEqual(["a", "b"]);
  });

  it("저장이 실패해도 토글 자체는 성립한다", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("프라이빗 모드");
      },
    });
    expect(() => togglePin("a")).not.toThrow();
  });
});

describe("고정/전체 가르기", () => {
  const items = [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }];
  const nameOf = (item: { name: string }) => item.name;

  it("고정된 것을 앞으로 빼고 나머지에서 제외한다 — 두 번 나오면 중복으로 읽힌다", () => {
    const { pinned, rest } = partitionByPin(items, ["c", "a"], nameOf);
    expect(pinned.map(nameOf)).toEqual(["c", "a"]);
    expect(rest.map(nameOf)).toEqual(["b", "d"]);
  });

  it("고정 순서를 지킨다 — 목록 순서가 아니라 고정한 순서다", () => {
    expect(partitionByPin(items, ["d", "b"], nameOf).pinned.map(nameOf)).toEqual(["d", "b"]);
  });

  it("현재 목록에 없는 핀은 무시한다 — 필터·검색으로 걸러진 것까지 끌어오지 않는다", () => {
    const { pinned, rest } = partitionByPin([{ name: "a" }], ["zzz", "a"], nameOf);
    expect(pinned.map(nameOf)).toEqual(["a"]);
    expect(rest).toEqual([]);
  });

  it("핀이 없으면 전부 나머지다", () => {
    expect(partitionByPin(items, [], nameOf).rest).toHaveLength(4);
  });
});
