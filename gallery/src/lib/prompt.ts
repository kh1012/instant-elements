import type { Entry } from "instant-elements/registry";

/**
 * 프롬프트 빌더.
 *
 * 갤러리의 핵심 상호작용 두 가지가 여기서 나온다:
 *  - **프롬프트 복사** — 이 컴포넌트를 다른 화면에 **가져다 쓰라**는 지시문. 코드를 복사하지 말고
 *    import 하라고 못 박는다(복사가 시작되는 순간 디자인 시스템이 갈라진다).
 *  - **수정 프롬프트 복사** — 붙여넣고 요청사항만 적으면 바로 고치기 시작할 수 있는 지시문.
 *    대상 파일·규칙·기록 절차가 이미 박혀 있어 사람이 매번 설명하지 않아도 된다.
 */

export interface PromptContext {
  /** 앱에서 컴포넌트를 부르는 별칭(설정의 importAlias). */
  importAlias: string;
  /** 갤러리 주소 — 결과를 눈으로 확인할 자리. */
  baseUrl: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "draft (검토 중)",
  stable: "stable (안정)",
};

export function importPathFor(entry: Entry, ctx: PromptContext): string {
  return `${ctx.importAlias}/${entry.name}`;
}

export function componentNameOf(entry: Entry): string {
  return entry.meta.exportName ?? entry.name;
}

function formatProps(entry: Entry): string {
  const props = entry.meta.props;
  if (!props?.length) return "";
  return props
    .filter((p) => p.editable !== false)
    .map((p) => {
      if (p.type === "enum" && p.options?.length) return `${p.name}:enum(${p.options.join("/")})`;
      if (p.type === "token" && p.scale) return `${p.name}:token(${p.scale})`;
      return `${p.name}:${p.type}`;
    })
    .join(" · ");
}

export function buildUsageExample(entry: Entry, ctx: PromptContext): string {
  const name = componentNameOf(entry);
  const importLine = `import { ${name} } from "${importPathFor(entry, ctx)}";`;
  const usage = entry.meta.usage ?? `<${name} />`;
  return `${importLine}\n\n${usage}`;
}

/** "프롬프트 복사" — 이 컴포넌트를 다른 화면에 통합하라는 지시문. */
export function buildIntegrationPrompt(entry: Entry, ctx: PromptContext): string {
  const name = componentNameOf(entry);
  const meta = entry.meta;
  const props = formatProps(entry);

  const lines: (string | null)[] = [
    `# 컴포넌트 통합: ${name}`,
    "",
    "이미 있는 디자인 시스템 컴포넌트를 **재사용**해 통합하는 작업이다. 코드를 복사하지 말고 아래 경로에서 import 해서 쓴다.",
    "",
    "## 컴포넌트",
    `- **역할**: ${meta.intent}`,
    `- **설명**: ${meta.summary}`,
    `- **상태**: ${STATUS_LABEL[meta.status] ?? meta.status} · **분류**: ${meta.category}`,
    "- **import**:",
    "  ```tsx",
    `  import { ${name} } from "${importPathFor(entry, ctx)}";`,
    "  ```",
    props ? `- **props**: ${props}` : null,
    meta.composedOf?.length ? `- **구성**: ${meta.composedOf.join(", ")}` : null,
    meta.tokens?.length ? `- **토큰**: ${meta.tokens.join(", ")}` : null,
    "",
    "## 사용 예제",
    "```tsx",
    buildUsageExample(entry, ctx),
    "```",
    "",
    "## 규칙",
    "- 색은 `st-*` 토큰만 (hex/rgb/hsl 금지). 크기·여백·라운드는 스케일만 (`text-step-*`, `rounded-md`, `gap-4` … — `[13px]` 류 임의값 금지).",
    "- 반응형·다크모드는 컴포넌트가 토큰으로 처리한다. 임의 색이나 값을 덧붙이지 않는다.",
    "",
    "## 통합 단계",
    `1. 위 import 로 \`${name}\` 을 가져온다 (복사 금지 — 이미 존재한다).`,
    "2. props 를 보고 필요한 **데이터·상태·핸들러**를 연결한다.",
    "3. 역할이 딱 맞지 않으면 **props/variant 확장을 먼저 검토**한다. 정말 없으면 새로 만든다.",
    "",
    "## 확인",
    `${ctx.baseUrl}/c/${entry.name}`,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

/**
 * "수정 프롬프트 복사" — 붙여넣고 요청사항만 적으면 바로 수정을 시작할 수 있는 지시문.
 *
 * 코드 위치는 엔트리의 `files` 에서 끌어오므로, 컴포넌트가 어디에 있든 그대로 동작한다.
 * 기록 절차(`ie element log`)를 함께 실어 "고쳤는데 이력이 없는" 상태를 만들지 않는다.
 */
export function buildModifyPrompt(entry: Entry, ctx: PromptContext): string {
  const meta = entry.meta;
  const sourcePath = entry.files[0]?.path ?? "";
  const sourceDir = sourcePath.replace(/\/[^/]+$/, "");
  const props = formatProps(entry);

  const lines: (string | null)[] = [
    `# 컴포넌트 수정: ${entry.name}`,
    "",
    '아래 **"요청사항"대로 이 컴포넌트를 수정**한다. 수정 후 히스토리에 기록까지 남긴다.',
    "",
    "## 대상",
    `- 컴포넌트: \`${entry.name}\` (${meta.status} · ${meta.category})`,
    `- 코드: \`${sourcePath}\``,
    `- import: \`${importPathFor(entry, ctx)}\``,
    `- 현재 역할: ${meta.intent}`,
    props ? `- props: ${props}` : null,
    "",
    "## 요청사항 (여기에 적으세요)",
    "> 예: 증감률을 오른쪽 정렬로 · 여백을 gap-4 로 · 강조색을 st-accent 로",
    "",
    "## 규칙",
    `- \`${sourceDir}/\` 안에서만 수정한다.`,
    "- 색은 `st-*` 토큰만, 크기·여백·라운드는 스케일만 — 임의 hex·px 금지.",
    "- 데모(`*.demo.tsx`)도 함께 맞춘다. 갤러리 카드가 그 파일을 그린다.",
    "",
    "## 기록 (건너뛰지 말 것)",
    "수정한 코드를 먼저 커밋한다 — 그 커밋이 복원 지점이 된다. 그다음:",
    "```bash",
    `ie element log ${entry.name} --action modified \\`,
    '  --note "<무엇을 바꿨는지 한 줄>" \\',
    '  --prompt "<위 요청사항 원문>" \\',
    "  --sha \"$(git rev-parse HEAD)\"",
    "```",
    "",
    "## 확인",
    `${ctx.baseUrl}/c/${entry.name}`,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}
