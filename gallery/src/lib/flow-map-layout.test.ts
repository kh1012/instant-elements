import { describe, expect, it } from "vitest";
import { COL_W, ROW_H, layoutScreens } from "./flow-map-layout";

const screens = (...slugs: string[]) => slugs.map((slug) => ({ slug }));
const edge = (from: string, to: string, broken?: boolean) => ({
  from: { slug: from },
  to,
  ...(broken === undefined ? {} : { broken }),
});

describe("layoutScreens", () => {
  it("선형 흐름은 한 줄로 늘어선다", () => {
    const out = layoutScreens({
      screens: screens("a", "b", "c"),
      edges: [edge("a", "b"), edge("b", "c")],
      start: "a",
    });
    expect(out["a"]).toEqual({ x: 0, y: 0 });
    expect(out["b"]).toEqual({ x: COL_W, y: 0 });
    expect(out["c"]).toEqual({ x: COL_W * 2, y: 0 });
  });

  it("갈라지면 같은 열에 위아래로 선다", () => {
    const out = layoutScreens({
      screens: screens("a", "b", "c"),
      edges: [edge("a", "b"), edge("a", "c")],
      start: "a",
    });
    expect(out["b"]?.x).toBe(COL_W);
    expect(out["c"]?.x).toBe(COL_W);
    expect(out["c"]?.y).toBe(ROW_H);
  });

  it("아무도 연결하지 않은 화면도 자리를 받는다 — 안 보이면 깜빡한 걸 모른다", () => {
    const out = layoutScreens({
      screens: screens("a", "b", "orphan"),
      edges: [edge("a", "b")],
      start: "a",
    });
    // 도달 깊이는 0,1 이므로 미도달은 그다음 열(2)에 선다.
    expect(out["orphan"]?.x).toBe(COL_W * 2);
  });

  it("끊긴 간선은 배치를 끌고 다니지 않는다", () => {
    const withBroken = layoutScreens({
      screens: screens("a", "b"),
      edges: [edge("a", "b", true)],
      start: "a",
    });
    // b 는 도달 불가 취급 → 미도달 열로 간다(0열의 다음).
    expect(withBroken["b"]?.x).toBe(COL_W);
    expect(withBroken["b"]?.y).toBe(0);
  });

  it("없는 화면을 가리키는 간선은 무시한다", () => {
    const out = layoutScreens({
      screens: screens("a"),
      edges: [edge("a", "지워진화면")],
      start: "a",
    });
    expect(out["a"]).toEqual({ x: 0, y: 0 });
    expect(Object.keys(out)).toHaveLength(1);
  });

  it("start 가 없거나 목록에 없으면 첫 화면을 기준으로 삼는다", () => {
    const noStart = layoutScreens({ screens: screens("a", "b"), edges: [edge("a", "b")] });
    expect(noStart["a"]?.x).toBe(0);

    const badStart = layoutScreens({
      screens: screens("a", "b"),
      edges: [edge("a", "b")],
      start: "없는화면",
    });
    expect(badStart["a"]?.x).toBe(0);
    expect(badStart["b"]?.x).toBe(COL_W);
  });

  it("순환이 있어도 멈춘다", () => {
    const out = layoutScreens({
      screens: screens("a", "b"),
      edges: [edge("a", "b"), edge("b", "a")],
      start: "a",
    });
    expect(out["a"]?.x).toBe(0);
    expect(out["b"]?.x).toBe(COL_W);
  });

  it("화면이 없으면 빈 배치를 돌려준다", () => {
    expect(layoutScreens({ screens: [], edges: [] })).toEqual({});
  });
});
