/**
 * 애니메이션 계약 — 프레임워크 의존 0.
 *
 * ── 왜 계약이 필요한가
 * "이 컴포넌트에 애니메이션 붙여줘" 라는 요청에 답하려면, 어떤 효과를 어디에 얹을 수 있는지
 * 알아야 한다. DOM 셀렉터로 추측하면 조용히 깨진다 — 포털로 빠져나가거나 마크업이 바뀌는 순간
 * 아무 경고 없이 아무 일도 일어나지 않는다. 그래서 **레지스트리에 선언된 것만** 인정한다.
 *
 * 두 축이 맞물린다:
 *  - **target**  — Composite 가 "내 여기에 효과를 얹을 수 있다"고 선언한 자리
 *  - **behavior** — Animations 가 "나는 이런 자리에 얹힐 수 있다"고 선언한 이식 가능한 효과
 *
 * 둘의 capability·host 가 맞아야 호환 쌍이 된다. 선언이 없으면 지원이 없는 것이지,
 * 추론으로 만들어 내지 않는다.
 */

export const ANIMATION_CAPABILITIES = [
  "pressable",
  "surface",
  "overlay-anchor",
  "pointer-trackable",
  "list",
  "text",
] as const;

export const ANIMATION_HOSTS = ["inline", "block", "part"] as const;

export const ANIMATION_TRIGGERS = ["load", "hover", "focus", "press", "change", "in-view"] as const;

/**
 * 모션 축소를 켠 사용자에게 무엇을 줄지. **선언 필수** —
 * 빠뜨리면 "축소하면 어떻게 되나"의 답이 없는 채로 배포된다.
 */
export const REDUCED_MOTION_POLICIES = ["static-feedback", "opacity-only", "disabled"] as const;

/** 파라미터가 참조할 수 있는 토큰 스케일. 자유 수치를 막는 화이트리스트다. */
export const REGISTERED_TOKEN_SCALES = ["duration", "spacing", "radius"] as const;

export type AnimationCapability = (typeof ANIMATION_CAPABILITIES)[number];
export type AnimationHost = (typeof ANIMATION_HOSTS)[number];
export type AnimationTrigger = (typeof ANIMATION_TRIGGERS)[number];
export type ReducedMotionPolicy = (typeof REDUCED_MOTION_POLICIES)[number];
export type TokenScale = (typeof REGISTERED_TOKEN_SCALES)[number];

export interface AnimationTarget {
  /** 컴포넌트 안에서 유일한 자리 이름. */
  id: string;
  location: "root" | "part";
  host: AnimationHost;
  capabilities: AnimationCapability[];
  /** `location: "part"` 일 때 그 자리를 노출하는 prop·hook 이름(증거). */
  part?: string;
  /** `list` capability 일 때 항목 키 prop. */
  keyProp?: string;
  /** `text` capability 일 때 텍스트 prop. */
  textProp?: string;
}

export interface AnimationEnumParameter {
  name: string;
  type: "enum";
  options: string[];
  default?: string;
}

export interface AnimationTokenParameter {
  name: string;
  type: "token";
  scale: TokenScale;
  options: string[];
  default?: string;
}

export type AnimationParameter = AnimationEnumParameter | AnimationTokenParameter;

export interface AnimationTargetMetadata {
  kind: "target";
  /** 얹을 자리가 없으면 빈 배열을 **명시**한다 — 생략과 "없음"은 다르다. */
  targets: AnimationTarget[];
}

export interface AnimationStandaloneMetadata {
  kind: "standalone";
  /** 왜 독립인지(자체 오버레이·수명주기 소유 등). */
  reason: string;
}

export interface AnimationBehaviorMetadata {
  kind: "behavior";
  behaviorId: string;
  /** 이 효과를 노출하는 named export 이름. */
  exportName: string;
  requires: AnimationCapability[];
  acceptsHosts: AnimationHost[];
  triggers: AnimationTrigger[];
  defaultTrigger: AnimationTrigger;
  parameters: AnimationParameter[];
  reducedMotion: ReducedMotionPolicy;
}

export type AnimationMetadata =
  | AnimationTargetMetadata
  | AnimationStandaloneMetadata
  | AnimationBehaviorMetadata;

export interface AnimationDiagnostic {
  level: "block" | "warn";
  message: string;
  hint?: string;
}

function isOneOf<T extends readonly string[]>(list: T, value: unknown): value is T[number] {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * 엔트리의 애니메이션 선언을 검증한다.
 *
 * `category` 가 결정한다:
 *  - `Composite`   → `kind: "target"` (얹을 자리가 없으면 `targets: []`)
 *  - `Animations`  → `kind: "standalone"` 또는 `"behavior"`
 *  - `System`      → 선언하지 않는다
 */
export function validateAnimation(
  category: string,
  animation: unknown,
  context: { name: string },
): AnimationDiagnostic[] {
  const out: AnimationDiagnostic[] = [];
  const block = (message: string, hint?: string) =>
    out.push({ level: "block", message, ...(hint ? { hint } : {}) });

  if (category === "System") {
    if (animation !== undefined) {
      out.push({
        level: "warn",
        message: `${context.name}: System 은 애니메이션을 선언하지 않습니다.`,
      });
    }
    return out;
  }

  if (animation === undefined || animation === null) {
    block(
      `${context.name}: meta.animation 이 없습니다.`,
      category === "Composite"
        ? '얹을 자리가 없으면 { "kind": "target", "targets": [] } 로 명시하세요 — 생략과 "없음"은 다릅니다.'
        : 'Animations 는 { "kind": "standalone" } 또는 { "kind": "behavior", … } 를 선언해야 합니다.',
    );
    return out;
  }

  if (typeof animation !== "object") {
    block(`${context.name}: meta.animation 은 객체여야 합니다.`);
    return out;
  }

  const meta = animation as Record<string, unknown>;
  const kind = meta["kind"];

  if (category === "Composite") {
    if (kind !== "target") {
      block(`${context.name}: Composite 는 kind 가 "target" 이어야 합니다 (지금: ${String(kind)}).`);
      return out;
    }
    const targets = meta["targets"];
    if (!Array.isArray(targets)) {
      block(`${context.name}: targets 는 배열이어야 합니다(없으면 빈 배열).`);
      return out;
    }

    const seen = new Set<string>();
    targets.forEach((raw, index) => {
      const target = raw as Record<string, unknown>;
      const id = typeof target["id"] === "string" ? target["id"] : "";
      if (!id) return block(`${context.name}: targets[${index}].id 가 없습니다.`);
      if (seen.has(id)) block(`${context.name}: target id 중복 — ${id}`);
      seen.add(id);

      if (target["location"] !== "root" && target["location"] !== "part") {
        block(`${context.name}: targets[${id}].location 은 root|part 여야 합니다.`);
      }
      if (!isOneOf(ANIMATION_HOSTS, target["host"])) {
        block(`${context.name}: targets[${id}].host 가 알 수 없는 값입니다: ${String(target["host"])}`);
      }

      const capabilities = target["capabilities"];
      if (!Array.isArray(capabilities) || capabilities.length === 0) {
        block(`${context.name}: targets[${id}].capabilities 가 비었습니다.`);
        return;
      }
      for (const capability of capabilities) {
        if (!isOneOf(ANIMATION_CAPABILITIES, capability)) {
          block(`${context.name}: targets[${id}] 에 알 수 없는 capability: ${String(capability)}`);
        }
      }

      // 증거 의무 — 선언만 하고 실제로 어디인지 못 가리키면 얹을 수 없다.
      if (target["location"] === "part" && typeof target["part"] !== "string") {
        block(
          `${context.name}: targets[${id}] 가 part 인데 part 필드가 없습니다.`,
          "그 자리를 노출하는 prop·hook 이름을 적으세요.",
        );
      }
      if (capabilities.includes("list") && typeof target["keyProp"] !== "string") {
        block(`${context.name}: targets[${id}] 가 list 인데 keyProp 이 없습니다.`);
      }
      if (capabilities.includes("text") && typeof target["textProp"] !== "string") {
        block(`${context.name}: targets[${id}] 가 text 인데 textProp 이 없습니다.`);
      }
    });
    return out;
  }

  // Animations
  if (kind === "standalone") {
    if (typeof meta["reason"] !== "string" || !meta["reason"]) {
      block(
        `${context.name}: standalone 은 reason 이 필요합니다.`,
        "왜 이식 가능한 behavior 가 아닌지(자체 오버레이·수명주기 소유 등) 적으세요.",
      );
    }
    return out;
  }

  if (kind !== "behavior") {
    block(`${context.name}: Animations 는 kind 가 standalone|behavior 여야 합니다 (지금: ${String(kind)}).`);
    return out;
  }

  if (typeof meta["behaviorId"] !== "string" || !meta["behaviorId"]) {
    block(`${context.name}: behaviorId 가 없습니다.`);
  }
  if (typeof meta["exportName"] !== "string" || !meta["exportName"]) {
    block(
      `${context.name}: exportName 이 없습니다.`,
      "이 효과를 노출하는 named export 이름이 있어야 다른 컴포넌트가 가져다 쓸 수 있습니다.",
    );
  }

  for (const [field, list] of [
    ["requires", ANIMATION_CAPABILITIES],
    ["acceptsHosts", ANIMATION_HOSTS],
    ["triggers", ANIMATION_TRIGGERS],
  ] as const) {
    const values = meta[field];
    if (!Array.isArray(values) || values.length === 0) {
      block(`${context.name}: ${field} 가 비었습니다.`);
      continue;
    }
    for (const value of values) {
      if (!isOneOf(list, value)) {
        block(`${context.name}: ${field} 에 알 수 없는 값: ${String(value)}`);
      }
    }
  }

  if (!isOneOf(ANIMATION_TRIGGERS, meta["defaultTrigger"])) {
    block(`${context.name}: defaultTrigger 가 알 수 없는 값입니다: ${String(meta["defaultTrigger"])}`);
  } else if (Array.isArray(meta["triggers"]) && !meta["triggers"].includes(meta["defaultTrigger"])) {
    block(`${context.name}: defaultTrigger 가 triggers 에 없습니다.`);
  }

  if (!isOneOf(REDUCED_MOTION_POLICIES, meta["reducedMotion"])) {
    block(
      `${context.name}: reducedMotion 이 없거나 알 수 없는 값입니다.`,
      `${REDUCED_MOTION_POLICIES.join(" | ")} 중 하나 — 모션 축소를 켠 사용자에게 무엇을 줄지 반드시 정합니다.`,
    );
  }

  const parameters = meta["parameters"];
  if (parameters !== undefined) {
    if (!Array.isArray(parameters)) {
      block(`${context.name}: parameters 는 배열이어야 합니다.`);
    } else {
      for (const raw of parameters) {
        const param = raw as Record<string, unknown>;
        const name = typeof param["name"] === "string" ? param["name"] : "(이름 없음)";
        if (param["type"] === "enum") {
          if (!Array.isArray(param["options"]) || param["options"].length === 0) {
            block(`${context.name}: parameters[${name}] enum 에 options 가 없습니다.`);
          }
        } else if (param["type"] === "token") {
          if (!isOneOf(REGISTERED_TOKEN_SCALES, param["scale"])) {
            block(
              `${context.name}: parameters[${name}] 의 scale 이 등록되지 않았습니다: ${String(param["scale"])}`,
              `등록된 스케일: ${REGISTERED_TOKEN_SCALES.join(", ")}`,
            );
          }
        } else {
          // 자유 수치·물리 파라미터를 막는다 — 열어 두면 컴포넌트마다 제각각인 값이 쌓이고
          // 어떤 값이 유효한지 아무도 모르게 된다.
          block(
            `${context.name}: parameters[${name}] 의 type 은 enum|token 이어야 합니다 (지금: ${String(param["type"])}).`,
            "자유 string·number·physics 파라미터는 받지 않습니다.",
          );
        }
      }
    }
  }

  return out;
}

/** behavior 가 target 에 얹힐 수 있는가. */
export function isCompatible(
  behavior: AnimationBehaviorMetadata,
  target: AnimationTarget,
): boolean {
  if (!behavior.acceptsHosts.includes(target.host)) return false;
  return behavior.requires.every((capability) => target.capabilities.includes(capability));
}
