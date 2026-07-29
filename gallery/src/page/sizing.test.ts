import { describe, expect, it } from "vitest";
import type { NodeProps } from "instant-elements/page";
import { flowOf, parseWidth, sizingStyle } from "./sizing";

const props = (overrides: Partial<NodeProps>): NodeProps => ({ id: "n-1", ...overrides });

describe("parseWidth", () => {
  it("세 형태를 모두 흡수한다 — 데이터에 섞여 들어온다", () => {
    expect(parseWidth("264px")).toBe("264px");
    expect(parseWidth("23%")).toBe("23%");
    expect(parseWidth("1/4")).toBe("25%");
    expect(parseWidth("1/3")).toBe("33.3333%");
  });

  it("단위 없는 숫자는 px 로 본다", () => {
    expect(parseWidth("264")).toBe("264px");
  });

  it("값이 없거나 이상하면 undefined", () => {
    expect(parseWidth(undefined)).toBeUndefined();
    expect(parseWidth("")).toBeUndefined();
    expect(parseWidth(42)).toBeUndefined();
  });

  it("0 으로 나누지 않는다", () => {
    expect(parseWidth("1/0")).toBe("1/0");
  });
});

describe("flowOf", () => {
  it("컨테이너별 자식 흐름을 안다", () => {
    expect(flowOf("Row")).toBe("row");
    expect(flowOf("Stack")).toBe("column");
    expect(flowOf("Frame")).toBe("column");
    expect(flowOf("Grid")).toBe("grid");
    expect(flowOf("stat-card")).toBe("none");
  });
});

describe("fill — 부모 방향에 따라 뜻이 달라진다", () => {
  it("Row 자식이면 flex 로 늘린다", () => {
    expect(sizingStyle(props({ _widthMode: "fill" }), "row")).toMatchObject({ flex: "1 1 0%" });
  });

  it("세로 흐름 자식이면 width 100% 로 늘린다 — flex:1 을 내면 세로로 늘어난다", () => {
    const style = sizingStyle(props({ _widthMode: "fill" }), "column");
    expect(style.width).toBe("100%");
    expect(style.flex).toBeUndefined();
  });

  it("Grid 자식이면 아무것도 내지 않는다 — 트랙이 폭을 정한다", () => {
    expect(sizingStyle(props({ _widthMode: "fill" }), "grid")).toEqual({});
  });
});

describe("fixed · hug", () => {
  it("fixed 는 폭을 고정하고 줄어들지 않게 한다", () => {
    expect(sizingStyle(props({ _widthMode: "fixed", _width: "264px" }), "row")).toMatchObject({
      width: "264px",
      flexShrink: 0,
    });
  });

  it("hug 는 내용에 맞추고 Row 안에서 늘어나지 않는다", () => {
    expect(sizingStyle(props({ _widthMode: "hug" }), "row")).toMatchObject({
      width: "fit-content",
      flex: "0 0 auto",
    });
  });

  it("모드 없이 _width 만 있으면 그대로 반영한다", () => {
    expect(sizingStyle(props({ _width: "1/2" }), "column").width).toBe("50%");
  });
});

describe("기타 구조 props", () => {
  it("높이·정렬·패딩을 방출한다", () => {
    expect(
      sizingStyle(props({ _height: "320", _alignSelf: "center", _padding: 16 }), "row"),
    ).toMatchObject({ height: "320px", alignSelf: "center", padding: 16 });
  });

  it("Grid 배치는 부모가 Grid 일 때만 나온다", () => {
    expect(sizingStyle(props({ _colSpan: 3 }), "grid")).toMatchObject({ gridColumn: "span 3" });
    expect(sizingStyle(props({ _colSpan: 3 }), "row").gridColumn).toBeUndefined();
  });

  it("시작 열과 스팬을 함께 주면 끝을 스팬으로 계산한다", () => {
    expect(sizingStyle(props({ _gridColStart: 2, _colSpan: 4 }), "grid")).toMatchObject({
      gridColumnStart: 2,
      gridColumnEnd: "span 4",
    });
  });

  it("행 스팬도 Grid 안에서만", () => {
    expect(sizingStyle(props({ _gridRow: 2 }), "grid")).toMatchObject({ gridRow: "span 2" });
  });
});
