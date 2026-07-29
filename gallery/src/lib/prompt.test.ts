import { describe, expect, it } from "vitest";
import type { Entry } from "instant-elements/registry";
import {
  buildIntegrationPrompt,
  buildModifyPrompt,
  buildSplitPrompt,
  buildUsageExample,
  componentNameOf,
  importPathFor,
  type PromptContext,
} from "./prompt";

const ctx: PromptContext = { importAlias: "@/elements", baseUrl: "http://127.0.0.1:9221" };

function entry(overrides: Partial<Entry["meta"]> = {}, files?: Entry["files"]): Entry {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: "stat-card",
    type: "registry:component",
    description: "지표 카드",
    files: files ?? [
      { path: "src/elements/stat-card/stat-card.tsx", type: "registry:component" },
    ],
    meta: {
      status: "draft",
      category: "Composite",
      intent: "대시보드 상단에 쓸 지표 카드 만들어줘",
      summary: "숫자 하나와 변화량을 함께 보여주는 카드입니다.",
      keywords: ["지표", "카드"],
      createdBy: "kh1012",
      createdAt: "2026-07-29T12:00:00.000Z",
      exportName: "StatCard",
      ...overrides,
    },
  };
}

describe("import 경로", () => {
  it("설정의 importAlias 를 그대로 쓴다 — 프로젝트마다 다른 별칭이 반영돼야 한다", () => {
    expect(importPathFor(entry(), ctx)).toBe("@/elements/stat-card");
    expect(importPathFor(entry(), { ...ctx, importAlias: "~/ui" })).toBe("~/ui/stat-card");
  });

  it("exportName 이 없으면 엔트리 이름으로 폴백한다", () => {
    expect(componentNameOf(entry())).toBe("StatCard");
    const noExport = entry();
    delete noExport.meta.exportName;
    expect(componentNameOf(noExport)).toBe("stat-card");
  });
});

describe("사용 예제", () => {
  it("import 문과 usage 스니펫을 함께 낸다", () => {
    const example = buildUsageExample(entry({ usage: '<StatCard title="매출" />' }), ctx);
    expect(example).toContain('import { StatCard } from "@/elements/stat-card";');
    expect(example).toContain('<StatCard title="매출" />');
  });

  it("usage 가 없으면 빈 태그로 폴백한다", () => {
    expect(buildUsageExample(entry(), ctx)).toContain("<StatCard />");
  });
});

describe("통합 프롬프트", () => {
  const prompt = buildIntegrationPrompt(
    entry({
      props: [
        { name: "title", type: "string", editable: true },
        { name: "tone", type: "enum", options: ["default", "danger"], editable: true },
        { name: "size", type: "token", scale: "spacing", editable: true },
        { name: "className", type: "string", editable: false },
      ],
      composedOf: ["badge"],
      tokens: ["st-card", "st-border"],
    }),
    ctx,
  );

  it("코드 복사가 아니라 import 를 지시한다 — 복사가 시작되면 디자인 시스템이 갈라진다", () => {
    expect(prompt).toContain("코드를 복사하지 말고");
    expect(prompt).toContain('import { StatCard } from "@/elements/stat-card";');
  });

  it("편집 가능한 props 만 요약한다", () => {
    expect(prompt).toContain("title:string");
    expect(prompt).toContain("tone:enum(default/danger)");
    expect(prompt).toContain("size:token(spacing)");
    expect(prompt).not.toContain("className:string");
  });

  it("하드룰을 함께 싣는다", () => {
    expect(prompt).toContain("st-*");
    expect(prompt).toMatch(/hex|rgb/);
  });

  it("구성·토큰·확인 링크를 포함한다", () => {
    expect(prompt).toContain("badge");
    expect(prompt).toContain("st-card, st-border");
    expect(prompt).toContain("http://127.0.0.1:9221/c/stat-card");
  });
});

describe("수정 프롬프트", () => {
  it("엔트리의 실제 코드 경로를 대상으로 삼는다 — 위치를 가정하지 않는다", () => {
    const prompt = buildModifyPrompt(
      entry({}, [{ path: "packages/app/ui/gnb/gnb.tsx", type: "registry:component" }]),
      ctx,
    );
    expect(prompt).toContain("packages/app/ui/gnb/gnb.tsx");
    expect(prompt).toContain("`packages/app/ui/gnb/`");
  });

  it("요청사항을 적을 자리를 비워 둔다", () => {
    expect(buildModifyPrompt(entry(), ctx)).toContain("## 요청사항 (여기에 적으세요)");
  });

  it("기록 절차를 함께 싣는다 — 고쳤는데 이력이 없는 상태를 만들지 않게", () => {
    const prompt = buildModifyPrompt(entry(), ctx);
    expect(prompt).toContain("ie element log stat-card --action modified");
    expect(prompt).toContain("--sha");
    expect(prompt).toContain("git rev-parse HEAD");
  });

  it("데모도 함께 맞추라고 지시한다 — 카드가 그 파일을 그린다", () => {
    expect(buildModifyPrompt(entry(), ctx)).toContain("*.demo.tsx");
  });
});

describe("분할 프롬프트", () => {
  it("수정과 다른 결과물을 요구한다 — 조각을 만들고 원본을 조립체로 바꾼다", () => {
    const prompt = buildSplitPrompt(entry(), ctx);
    expect(prompt).toContain("ie element new");
    expect(prompt).toContain("composedOf");
    expect(prompt).toContain("Composite");
  });

  it("공개 API 를 지키라고 못 박는다 — 소비처를 고쳐야 하면 분할이 아니라 파괴다", () => {
    expect(buildSplitPrompt(entry(), ctx)).toContain("공개 API");
  });

  it("쪼개는 것 자체가 목적이 아님을 알린다 — 이르면 멈추라고 지시한다", () => {
    const prompt = buildSplitPrompt(entry(), ctx);
    expect(prompt).toContain("멈추고");
    expect(prompt).toContain("쪼개는 것 자체가 목적이 아니다");
  });

  it("이미 조립된 조각이 있으면 거기에 더하라고 안내한다", () => {
    const withParts = buildSplitPrompt(entry({ composedOf: ["badge", "avatar"] }), ctx);
    expect(withParts).toContain("badge, avatar");
    expect(buildSplitPrompt(entry(), ctx)).toContain("아직 단일 컴포넌트");
  });

  it("기록 절차를 함께 싣는다", () => {
    expect(buildSplitPrompt(entry(), ctx)).toContain("ie element log stat-card --action modified");
  });
});
