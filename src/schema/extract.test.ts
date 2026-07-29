import { describe, expect, it } from "vitest";
import { classifyType, extractProps, findPropsBody, propsEqual, toEntryProps } from "./extract.js";

const source = `
import { cn } from "../_lib/cn";

export interface StatCardProps {
  /** 카드 제목 */
  title: string;
  description?: string;
  /** 강조 톤 */
  tone?: "default" | "success" | "danger";
  count?: number;
  compact?: boolean;
  items?: string[];
  onSelect?: (id: string) => void;
  onClear?: () => void;
  icon?: ReactNode;
  meta?: { updatedAt: string; by: string };
  className?: string;
}

export function StatCard({ title }: StatCardProps) {
  return <div>{title}</div>;
}
`;

describe("Props 본문 찾기", () => {
  it("exportName 으로 정확한 인터페이스를 고른다", () => {
    const multi = `
      export interface OtherProps { a: string }
      export interface StatCardProps { b: number }
    `;
    expect(findPropsBody(multi, "StatCard")?.trim()).toBe("b: number");
  });

  it("중첩 객체가 있어도 끝을 정확히 찾는다", () => {
    const body = findPropsBody(source, "StatCard");
    expect(body).toContain("meta?: { updatedAt: string; by: string }");
    expect(body).not.toContain("export function StatCard");
  });

  it("type 별칭도 읽는다", () => {
    expect(findPropsBody("export type BadgeProps = { tone: string };", "Badge")?.trim()).toBe(
      "tone: string",
    );
  });

  it("없으면 null", () => {
    expect(findPropsBody("export function X() { return null }")).toBeNull();
  });
});

describe("타입 분류", () => {
  it("원시 타입", () => {
    expect(classifyType("string").type).toBe("string");
    expect(classifyType("number").type).toBe("number");
    expect(classifyType("boolean").type).toBe("boolean");
  });

  it("리터럴 유니온은 enum 과 옵션으로", () => {
    expect(classifyType('"a" | "b" | "c"')).toEqual({ type: "enum", options: ["a", "b", "c"] });
  });

  it("리터럴이 아닌 유니온은 enum 이 아니다 — 옵션을 지어내면 안 된다", () => {
    expect(classifyType("string | number").type).not.toBe("enum");
  });

  it("함수는 동작이다 — 흐름이 여기 붙는다", () => {
    expect(classifyType("() => void").type).toBe("action");
    expect(classifyType("(id: string) => void").type).toBe("action");
  });

  it("배열·노드·객체", () => {
    expect(classifyType("string[]").type).toBe("array");
    expect(classifyType("Array<Item>").type).toBe("array");
    expect(classifyType("ReactNode").type).toBe("node");
    expect(classifyType("{ a: string }").type).toBe("object");
  });
});

describe("추출", () => {
  const { props, found } = extractProps(source, "StatCard");
  const byName = Object.fromEntries(props.map((p) => [p.name, p]));

  it("Props 를 찾았음을 알린다 — 빈 배열과 구분해야 한다", () => {
    expect(found).toBe(true);
    expect(extractProps("export function X() {}").found).toBe(false);
  });

  it("필수와 선택을 구분한다", () => {
    expect(byName["title"]?.required).toBe(true);
    expect(byName["description"]?.required).toBe(false);
  });

  it("JSDoc 한 줄을 라벨로 쓴다", () => {
    expect(byName["title"]?.label).toBe("카드 제목");
    expect(byName["tone"]?.label).toBe("강조 톤");
  });

  it("enum 옵션을 뽑는다", () => {
    expect(byName["tone"]?.options).toEqual(["default", "success", "danger"]);
  });

  it("콜백을 동작으로 분류한다", () => {
    expect(byName["onSelect"]?.type).toBe("action");
    expect(byName["onClear"]?.type).toBe("action");
  });

  it("className 은 편집 표면에서 감춘다 — 화면에서 바꿀 이유가 없다", () => {
    expect(byName["className"]?.editable).toBe(false);
    expect(byName["title"]?.editable).toBe(true);
  });

  it("모든 멤버를 빠짐없이 읽는다", () => {
    expect(props.map((p) => p.name)).toEqual([
      "title",
      "description",
      "tone",
      "count",
      "compact",
      "items",
      "onSelect",
      "onClear",
      "icon",
      "meta",
      "className",
    ]);
  });

  it("엔트리 저장 형태에는 진단용 raw 가 없다", () => {
    expect(Object.keys(toEntryProps(props)[0] ?? {})).not.toContain("raw");
  });
});

describe("드리프트 판정", () => {
  it("같으면 같다고, 다르면 다르다고 한다", () => {
    const a = [{ name: "title", type: "string" as const, required: true, editable: true }];
    expect(propsEqual(a, a)).toBe(true);
    expect(propsEqual(a, [{ ...a[0]!, required: false }])).toBe(false);
    expect(propsEqual(undefined, [])).toBe(true);
  });
});
