import { describe, expect, it } from "vitest";
import type { Entry } from "instant-elements/registry";
import { isNew, searchEntries, sortEntries } from "./search";

function entry(name: string, overrides: Partial<Entry["meta"]> = {}): Entry {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:component",
    description: name,
    files: [{ path: `src/elements/${name}/${name}.tsx`, type: "registry:component" }],
    meta: {
      status: "draft",
      category: "Composite",
      intent: `${name} 역할`,
      summary: `${name} 설명`,
      keywords: [name],
      createdBy: "t",
      createdAt: "2026-07-01T00:00:00.000Z",
      ...overrides,
    },
  };
}

const entries = [
  entry("stat-card", { summary: "숫자와 변화량을 보여주는 카드", keywords: ["지표", "카드"] }),
  entry("global-nav-bar", { summary: "상단 내비게이션 바", keywords: ["gnb", "내비게이션"] }),
  entry("fade-in", { summary: "서서히 나타나는 효과", keywords: ["애니메이션"] }),
];

describe("검색", () => {
  it("빈 질의는 전부 돌려준다", () => {
    expect(searchEntries(entries, "  ")).toHaveLength(3);
  });

  it("이름·설명·검색어를 함께 훑는다", () => {
    expect(searchEntries(entries, "카드").map((e) => e.name)).toEqual(["stat-card"]);
    expect(searchEntries(entries, "내비게이션").map((e) => e.name)).toEqual(["global-nav-bar"]);
    expect(searchEntries(entries, "nav").map((e) => e.name)).toEqual(["global-nav-bar"]);
  });

  it("여러 단어는 AND 로 좁힌다 — 조건을 더할수록 결과가 줄어드는 게 직관적이다", () => {
    expect(searchEntries(entries, "지표 카드").map((e) => e.name)).toEqual(["stat-card"]);
    expect(searchEntries(entries, "지표 내비게이션")).toEqual([]);
  });

  it("대소문자를 구분하지 않는다", () => {
    expect(searchEntries(entries, "GNB").map((e) => e.name)).toEqual(["global-nav-bar"]);
  });
});

describe("정렬", () => {
  const mixed = [
    entry("zulu", { createdAt: "2026-07-01T00:00:00.000Z" }),
    entry("alpha", { createdAt: "2026-07-20T00:00:00.000Z" }),
    entry("mike", { createdAt: "2026-07-10T00:00:00.000Z" }),
  ];

  it("이름순", () => {
    expect(sortEntries(mixed, "name").map((e) => e.name)).toEqual(["alpha", "mike", "zulu"]);
  });

  it("최신순", () => {
    expect(sortEntries(mixed, "recent").map((e) => e.name)).toEqual(["alpha", "mike", "zulu"]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const input = [...mixed];
    sortEntries(input, "name");
    expect(input.map((e) => e.name)).toEqual(["zulu", "alpha", "mike"]);
  });
});

describe("isNew", () => {
  const now = Date.parse("2026-07-29T12:00:00.000Z");

  it("24시간 안이면 새 것", () => {
    expect(isNew(entry("x", { createdAt: "2026-07-29T02:00:00.000Z" }), now)).toBe(true);
  });

  it("24시간이 지나면 아니다", () => {
    expect(isNew(entry("x", { createdAt: "2026-07-27T12:00:00.000Z" }), now)).toBe(false);
  });

  it("잘못된 시각은 새 것으로 보지 않는다", () => {
    expect(isNew(entry("x", { createdAt: "언제인지 모름" }), now)).toBe(false);
  });
});
