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

/**
 * "분할 프롬프트" — 한 컴포넌트가 너무 커졌을 때 **조각으로 쪼개 다시 조립**하라는 지시문.
 *
 * 수정 프롬프트와 갈리는 지점은 **결과물의 성격**이다. 수정은 컴포넌트 하나를 고치고 끝나지만,
 * 분할은 조각 엔트리를 새로 만들고 원본을 그 조각들의 조립으로 바꾼다 — 그래서 원본이 단일
 * 컴포넌트에서 **조립체**가 되고, 그 사실이 `composedOf` 와 히스토리에 남아야 한다.
 * 위계를 안 남기면 갤러리에서는 여전히 단일 컴포넌트로 보여 관계가 사라진다.
 *
 * _근거: 상류 하네스 23f4ff6b0._
 */
export function buildSplitPrompt(entry: Entry, ctx: PromptContext): string {
  const name = componentNameOf(entry);
  const meta = entry.meta;
  const sourcePath = entry.files[0]?.path ?? "";
  const props = formatProps(entry);

  const lines: (string | null)[] = [
    `# 컴포넌트 분할: ${entry.name}`,
    "",
    `\`${entry.name}\` 이 한 덩어리로 너무 많은 책임을 안고 있어 **조각 컴포넌트로 분해**한다.`,
    "분해가 끝나면 이 컴포넌트는 단일 컴포넌트가 아니라 **조각을 조립한 것**이 된다 —",
    "그 위계가 엔트리와 히스토리에 남아야 갤러리에서 관계가 보인다.",
    "",
    "## 대상",
    `- 컴포넌트: \`${entry.name}\` (${meta.status} · ${meta.category})`,
    `- 코드: \`${sourcePath}\``,
    `- import: \`${importPathFor(entry, ctx)}\``,
    `- 현재 역할: ${meta.intent}`,
    props ? `- 공개 props: ${props}` : null,
    meta.composedOf?.length
      ? `- 이미 조립된 조각: ${meta.composedOf.join(", ")} ← 여기에 더한다`
      : "- 현재 `composedOf` 없음 (= 아직 단일 컴포넌트)",
    "",
    "## 절차",
    "",
    "### 1. 분석",
    "- 파일을 읽고 **책임 단위**를 가른다: 어디까지가 한 덩어리이고 반복되는 마크업이 무엇인지.",
    "- 분할 근거를 적는다(길이 · 책임 수 · 다른 화면에서도 쓸 만한 조각인지).",
    "- **아직 이르다고 판단되면 여기서 멈추고 이유를 보고한다.** 원본에서만 쓰이고 재사용 여지가",
    "  없는 조각은 파일 수만 늘린다. 쪼개는 것 자체가 목적이 아니다.",
    "",
    "### 2. 조립 단위 정의",
    "- 조각마다 **이름 · 역할 한 줄 · props 계약**을 코드보다 먼저 적는다.",
    "- 조각은 원본을 몰라도 혼자 성립해야 한다 — 부모 상태를 직접 만지지 말고 값·콜백으로만 받는다.",
    "",
    "### 3. 조각 생성 (element-create 절차 그대로)",
    "```bash",
    'npx ie element new <조각이름> --intent "…" --summary "…" --keywords "…"',
    "```",
    "- 조각도 갤러리에 뜨는 정식 엔트리다. 임시 파일로 흩뿌리지 않는다.",
    "",
    "### 4. 재조립",
    `- \`${name}\` 본문을 조각들의 조합으로 다시 쓴다.`,
    "- **공개 API(props · export 이름)는 그대로 둔다** — 소비처를 고쳐야 한다면 분할이 아니라 파괴다.",
    "- 재조립 뒤 데모가 이전과 같은 화면을 그리는지 눈으로 확인한다.",
    "",
    "### 5. 위계 정리 (분할의 마무리)",
    `- 엔트리의 \`meta.composedOf\` 에 만든 조각 이름을 **전부** 넣는다.`,
    "- 조각을 조립하는 자리가 되었으므로 `meta.category` 를 `Composite` 로 맞춘다.",
    "- 인덱스와 검증을 다시 돌린다:",
    "```bash",
    "npx ie index && npx ie element schema && npx ie element validate",
    "```",
    "",
    "### 6. 기록",
    "코드 변경을 먼저 커밋한 뒤:",
    "```bash",
    `npx ie element log ${entry.name} --action modified \\`,
    '  --note "<N>개 조각으로 분할" \\',
    "  --sha \"$(git rev-parse HEAD)\"",
    "```",
    "",
    "## 확인",
    `${ctx.baseUrl}/c/${entry.name}`,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}
