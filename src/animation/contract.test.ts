import { describe, expect, it } from "vitest";
import {
  isCompatible,
  validateAnimation,
  type AnimationBehaviorMetadata,
  type AnimationTarget,
} from "./contract.js";

const ctx = { name: "x" };
const blocks = (result: ReturnType<typeof validateAnimation>) =>
  result.filter((d) => d.level === "block").map((d) => d.message);

describe("Composite — target 선언", () => {
  it("얹을 자리가 없어도 빈 배열을 명시해야 한다 — 생략과 '없음'은 다르다", () => {
    expect(blocks(validateAnimation("Composite", undefined, ctx))).toHaveLength(1);
    expect(validateAnimation("Composite", { kind: "target", targets: [] }, ctx)).toEqual([]);
  });

  it("올바른 target 을 통과시킨다", () => {
    const animation = {
      kind: "target",
      targets: [{ id: "root", location: "root", host: "inline", capabilities: ["pressable"] }],
    };
    expect(validateAnimation("Composite", animation, ctx)).toEqual([]);
  });

  it("알 수 없는 capability·host 를 거부한다", () => {
    const animation = {
      kind: "target",
      targets: [{ id: "root", location: "root", host: "floating", capabilities: ["glowable"] }],
    };
    const messages = blocks(validateAnimation("Composite", animation, ctx));
    expect(messages.some((m) => m.includes("host"))).toBe(true);
    expect(messages.some((m) => m.includes("capability"))).toBe(true);
  });

  it("id 중복을 잡는다", () => {
    const target = { id: "root", location: "root", host: "inline", capabilities: ["surface"] };
    const messages = blocks(
      validateAnimation("Composite", { kind: "target", targets: [target, target] }, ctx),
    );
    expect(messages.some((m) => m.includes("중복"))).toBe(true);
  });

  it("증거 없는 선언을 막는다 — 어디인지 못 가리키면 얹을 수 없다", () => {
    const part = blocks(
      validateAnimation(
        "Composite",
        { kind: "target", targets: [{ id: "x", location: "part", host: "part", capabilities: ["surface"] }] },
        ctx,
      ),
    );
    expect(part.some((m) => m.includes("part 필드"))).toBe(true);

    const list = blocks(
      validateAnimation(
        "Composite",
        { kind: "target", targets: [{ id: "x", location: "root", host: "block", capabilities: ["list"] }] },
        ctx,
      ),
    );
    expect(list.some((m) => m.includes("keyProp"))).toBe(true);
  });

  it("Composite 에 standalone 을 선언하면 거부한다", () => {
    expect(blocks(validateAnimation("Composite", { kind: "standalone", reason: "x" }, ctx))).toHaveLength(1);
  });
});

describe("Animations — standalone", () => {
  it("이유를 요구한다 — 왜 이식 가능하지 않은지 남겨야 한다", () => {
    expect(blocks(validateAnimation("Animations", { kind: "standalone" }, ctx))).toHaveLength(1);
    expect(
      validateAnimation("Animations", { kind: "standalone", reason: "자체 오버레이 소유" }, ctx),
    ).toEqual([]);
  });
});

describe("Animations — behavior", () => {
  const valid = {
    kind: "behavior",
    behaviorId: "press-ripple",
    exportName: "PressRipple",
    requires: ["pressable"],
    acceptsHosts: ["inline"],
    triggers: ["press"],
    defaultTrigger: "press",
    parameters: [{ name: "intensity", type: "enum", options: ["subtle", "strong"], default: "subtle" }],
    reducedMotion: "static-feedback",
  };

  it("올바른 behavior 를 통과시킨다", () => {
    expect(validateAnimation("Animations", valid, ctx)).toEqual([]);
  });

  it("exportName 이 없으면 거부한다 — 없으면 가져다 쓸 수 없다", () => {
    const { exportName: _drop, ...rest } = valid;
    expect(blocks(validateAnimation("Animations", rest, ctx)).some((m) => m.includes("exportName"))).toBe(true);
  });

  it("reducedMotion 을 요구한다 — 모션 축소 사용자에게 무엇을 줄지 정해야 한다", () => {
    const { reducedMotion: _drop, ...rest } = valid;
    expect(
      blocks(validateAnimation("Animations", rest, ctx)).some((m) => m.includes("reducedMotion")),
    ).toBe(true);
  });

  it("defaultTrigger 가 triggers 밖이면 거부한다", () => {
    const messages = blocks(validateAnimation("Animations", { ...valid, defaultTrigger: "hover" }, ctx));
    expect(messages.some((m) => m.includes("defaultTrigger"))).toBe(true);
  });

  it("자유 수치 파라미터를 막는다 — 열어 두면 제각각인 값이 쌓인다", () => {
    const messages = blocks(
      validateAnimation("Animations", { ...valid, parameters: [{ name: "stiffness", type: "number" }] }, ctx),
    );
    expect(messages.some((m) => m.includes("enum|token"))).toBe(true);
  });

  it("등록되지 않은 토큰 스케일을 막는다", () => {
    const messages = blocks(
      validateAnimation(
        "Animations",
        { ...valid, parameters: [{ name: "speed", type: "token", scale: "velocity", options: ["fast"] }] },
        ctx,
      ),
    );
    expect(messages.some((m) => m.includes("scale"))).toBe(true);
  });

  it("등록된 스케일은 통과한다", () => {
    expect(
      validateAnimation(
        "Animations",
        { ...valid, parameters: [{ name: "speed", type: "token", scale: "duration", options: ["fast"] }] },
        ctx,
      ),
    ).toEqual([]);
  });
});

describe("System", () => {
  it("선언하지 않는 게 정상이다", () => {
    expect(validateAnimation("System", undefined, ctx)).toEqual([]);
  });

  it("선언하면 경고하되 막지는 않는다", () => {
    const result = validateAnimation("System", { kind: "standalone", reason: "x" }, ctx);
    expect(result).toHaveLength(1);
    expect(result[0]?.level).toBe("warn");
  });
});

describe("호환 판정", () => {
  const behavior: AnimationBehaviorMetadata = {
    kind: "behavior",
    behaviorId: "press-ripple",
    exportName: "PressRipple",
    requires: ["pressable", "surface"],
    acceptsHosts: ["inline"],
    triggers: ["press"],
    defaultTrigger: "press",
    parameters: [],
    reducedMotion: "static-feedback",
  };
  const target = (over: Partial<AnimationTarget>): AnimationTarget => ({
    id: "root",
    location: "root",
    host: "inline",
    capabilities: ["pressable", "surface"],
    ...over,
  });

  it("host 와 capability 가 모두 맞아야 얹힌다", () => {
    expect(isCompatible(behavior, target({}))).toBe(true);
  });

  it("host 가 다르면 안 얹힌다", () => {
    expect(isCompatible(behavior, target({ host: "block" }))).toBe(false);
  });

  it("요구 capability 가 하나라도 없으면 안 얹힌다", () => {
    expect(isCompatible(behavior, target({ capabilities: ["pressable"] }))).toBe(false);
  });
});
