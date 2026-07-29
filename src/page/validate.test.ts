import { describe, expect, it } from "vitest";
import type { PageData } from "./schema.js";
import { pageErrors, validatePageData } from "./validate.js";

function page(content: unknown[]): PageData {
  return { root: { props: {} }, content: content as PageData["content"], zones: {} };
}

const known = new Set(["stat-card", "order-status"]);
const renderable = new Set(["stat-card"]);
const opts = { knownComponents: known, renderableComponents: renderable };

describe("id 규칙", () => {
  it("id 없는 노드를 잡는다 — 피드백도 흐름도 그 자리를 가리킬 수 없다", () => {
    const issues = pageErrors(validatePageData(page([{ type: "Heading", props: { text: "x" } }])));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("props.id");
  });

  it("id 중복을 잡는다 — 어느 쪽인지 구분할 수 없다", () => {
    const issues = pageErrors(
      validatePageData(
        page([
          { type: "Heading", props: { id: "H-1", text: "a" } },
          { type: "Heading", props: { id: "H-1", text: "b" } },
        ]),
      ),
    );
    expect(issues.some((i) => i.message.includes("중복"))).toBe(true);
  });

  it("중첩 안쪽의 id 누락도 잡는다", () => {
    const issues = pageErrors(
      validatePageData(
        page([
          {
            type: "Stack",
            props: { id: "S-1", items: [{ type: "Text", props: { text: "no id" } }] },
          },
        ]),
      ),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toContain("S-1");
  });

  it("빈 문자열 id 는 id 가 아니다", () => {
    expect(pageErrors(validatePageData(page([{ type: "Text", props: { id: "  " } }])))).toHaveLength(1);
  });
});

describe("자식 배치", () => {
  it("children 오용을 잡는다 — 렌더가 읽지 않아 컨테이너가 그냥 빈다", () => {
    const issues = pageErrors(
      validatePageData(
        page([
          {
            type: "Stack",
            props: { id: "S-1", children: [{ type: "Text", props: { id: "T-1" } }] },
          },
        ]),
      ),
    );
    expect(issues.some((i) => i.message.includes("props.children"))).toBe(true);
  });

  it("컨테이너가 아닌 노드가 자식을 담으면 잡는다", () => {
    const issues = pageErrors(
      validatePageData(
        page([
          { type: "Heading", props: { id: "H-1", items: [{ type: "Text", props: { id: "T-1" } }] } },
        ]),
      ),
    );
    expect(issues.some((i) => i.message.includes("자식을 담을 수 없습니다"))).toBe(true);
  });

  it("items 가 배열이 아니면 잡는다", () => {
    const issues = pageErrors(
      validatePageData(page([{ type: "Stack", props: { id: "S-1", items: "nope" } }])),
    );
    expect(issues.some((i) => i.message.includes("배열"))).toBe(true);
  });
});

describe("컴포넌트 이름", () => {
  it("레지스트리에 없는 이름을 잡고 Placeholder 를 안내한다", () => {
    const issues = pageErrors(
      validatePageData(page([{ type: "nonexistent", props: { id: "x-1" } }]), opts),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.hint).toContain("Placeholder");
  });

  it("데모가 없으면 경고만 한다 — 저장은 막지 않는다", () => {
    const issues = validatePageData(page([{ type: "order-status", props: { id: "o-1" } }]), opts);
    expect(pageErrors(issues)).toHaveLength(0);
    expect(issues.some((i) => i.level === "warn")).toBe(true);
  });

  it("프리미티브는 레지스트리에 없어도 정상이다", () => {
    expect(
      pageErrors(validatePageData(page([{ type: "Placeholder", props: { id: "p-1" } }]), opts)),
    ).toHaveLength(0);
  });

  it("등록·렌더 가능한 컴포넌트는 통과한다", () => {
    expect(
      pageErrors(
        validatePageData(page([{ type: "stat-card", props: { id: "s-1", title: "매출" } }]), opts),
      ),
    ).toHaveLength(0);
  });
});

describe("정상 페이지", () => {
  it("문제가 없으면 빈 목록", () => {
    const data = page([
      {
        type: "Stack",
        props: {
          id: "Stack-1",
          gap: 16,
          _role: "main",
          items: [
            { type: "Heading", props: { id: "H-1", level: 2, text: "주문" } },
            { type: "stat-card", props: { id: "stat-card-1", title: "합계" } },
          ],
        },
      },
    ]);
    expect(validatePageData(data, opts)).toEqual([]);
  });

  it("content 가 배열이 아니면 그것부터 알린다", () => {
    const issues = validatePageData({ root: { props: {} } } as PageData);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("content");
  });
});
