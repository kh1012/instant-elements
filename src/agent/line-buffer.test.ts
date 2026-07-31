import { describe, expect, it } from "vitest";
import { createLineBuffer } from "./line-buffer.js";

describe("createLineBuffer", () => {
  it("완성된 줄만 돌려주고 마지막 조각은 붙들고 있는다", () => {
    const buffer = createLineBuffer();
    expect(buffer.push('{"a":1}\n{"b":')).toEqual(['{"a":1}']);
    expect(buffer.push('2}\n')).toEqual(['{"b":2}']);
  });

  it("한 줄이 청크 셋에 걸쳐 와도 온전히 복원한다", () => {
    const buffer = createLineBuffer();
    expect(buffer.push('{"long"')).toEqual([]);
    expect(buffer.push(':"value"')).toEqual([]);
    expect(buffer.push("}\n")).toEqual(['{"long":"value"}']);
  });

  it("한 청크에 여러 줄이 담겨도 전부 돌려준다", () => {
    const buffer = createLineBuffer();
    expect(buffer.push("a\nb\nc\n")).toEqual(["a", "b", "c"]);
  });

  it("빈 줄은 버린다 — CLI 가 넣는 여백은 이벤트가 아니다", () => {
    const buffer = createLineBuffer();
    expect(buffer.push("a\n\n\nb\n")).toEqual(["a", "b"]);
  });

  it("flush 가 개행 없이 끝난 마지막 줄을 흘려보낸다", () => {
    const buffer = createLineBuffer();
    expect(buffer.push("done")).toEqual([]);
    expect(buffer.flush()).toEqual(["done"]);
  });

  it("flush 는 한 번만 내보낸다 — 두 번 부른다고 중복되지 않는다", () => {
    const buffer = createLineBuffer();
    buffer.push("tail");
    expect(buffer.flush()).toEqual(["tail"]);
    expect(buffer.flush()).toEqual([]);
  });

  it("깔끔하게 끝난 스트림은 flush 할 게 없다", () => {
    const buffer = createLineBuffer();
    buffer.push("a\n");
    expect(buffer.flush()).toEqual([]);
  });
});
