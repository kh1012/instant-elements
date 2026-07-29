import { pascalCase } from "./paths.js";

/**
 * 스캐폴드 템플릿.
 *
 * 생성 직후의 컴포넌트는 **바로 갤러리에서 보이는 상태**여야 한다. 빈 스텁을 내면 에이전트가
 * 채우기 전까지 카드가 비어 있고, 그러면 "만들었다"는 신호가 화면에 안 잡힌다. 그래서 기본 렌더를
 * 실제로 그린다 — 어차피 다음 프롬프트에서 대부분 교체되지만, 그 전까지도 루프가 성립한다.
 *
 * 모든 템플릿은 하드룰을 지킨 상태로 나온다: 색은 `st-*` 토큰만, 크기·여백·라운드는 스케일만.
 * 그래서 갓 만든 컴포넌트가 검증 게이트를 그냥 통과한다.
 */

export interface TemplateInput {
  name: string;
  exportName: string;
  summary: string;
  /** `cn` 헬퍼를 가져올 상대 경로(예: "../_lib/cn"). */
  cnImport: string;
}

export function componentTemplate({ name, exportName, summary, cnImport }: TemplateInput): string {
  return `import { cn } from "${cnImport}";

export interface ${exportName}Props {
  /** 제목 줄. */
  title?: string;
  /** 제목 아래 보조 설명. */
  description?: string;
  className?: string;
}

/**
 * ${summary}
 *
 * 색은 st-* 토큰만, 크기·여백·라운드는 스케일만 쓴다(임의 hex·[13px] 금지).
 */
export function ${exportName}({
  title = "${exportName}",
  description,
  className,
}: ${exportName}Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-st-border bg-st-card p-4",
        "text-st-card-foreground",
        className,
      )}
    >
      <p className="text-step-1 font-semibold">{title}</p>
      {description ? <p className="text-step-n1 text-st-muted-foreground">{description}</p> : null}
    </div>
  );
}

${exportName}.displayName = "${exportName}";

// 컴포넌트 이름: ${name}
`;
}

export function demoTemplate({ name, exportName }: TemplateInput): string {
  return `import { ${exportName} } from "./${name}";

/**
 * 갤러리 미리보기 한 컷.
 *
 * default export 여야 하고, props 없이 스스로 그려져야 한다(갤러리가 인자를 주지 않는다).
 * 카드 프레임이 작으므로 대표적인 상태 **하나만** 담는다 — 타이머·루프 애니메이션은 넣지 않는다.
 */
export default function ${exportName}Demo() {
  return (
    <div className="w-72">
      <${exportName} title="${exportName}" description="여기에 대표 상태 한 컷을 담습니다." />
    </div>
  );
}
`;
}

export function indexTemplate({ name }: TemplateInput): string {
  return `export * from "./${name}";\n`;
}

/**
 * `cn` 헬퍼 — 프로젝트 안에 **복사해서** 둔다(라이브러리에서 import 하지 않는다).
 *
 * 그래야 instant-elements 가 devDependency 로만 남고, 소비 프로젝트의 런타임 번들에
 * 툴링 패키지가 끌려 들어가지 않는다. 소유권도 프로젝트에 있다.
 */
export function cnTemplate(): string {
  return `/**
 * 클래스 이름 합치기.
 *
 * 의존성 없이 truthy 한 값만 이어 붙인다. Tailwind 유틸이 서로 충돌할 때(예: p-2 와 p-4)
 * 나중 값이 이기게 하려면 아래처럼 tailwind-merge 로 바꾸면 된다:
 *
 *   npm i clsx tailwind-merge
 *
 *   import { clsx, type ClassValue } from "clsx";
 *   import { twMerge } from "tailwind-merge";
 *   export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
 */
export type ClassValue = string | number | null | false | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
`;
}

export function configTemplate(options: {
  elementsDir: string;
  importAlias: string;
  registryDir: string;
  pagesDir: string;
  flowsDir: string;
}): string {
  // `import type` 이어야 한다. 값으로 import 하면 설정을 읽는 시점에 instant-elements 모듈을
  // 실제로 해석해야 하는데, `npx instant-elements init` 처럼 패키지가 프로젝트에 설치되지 않은
  // 상태에서는 그 해석이 실패해 **이후 모든 명령이 설정을 못 읽는다**. 타입 전용 import 는
  // 트랜스파일 시 완전히 지워지므로 런타임 의존이 0이고, 설치돼 있으면 자동완성도 그대로 받는다.
  return `import type { InstantElementsConfig } from "instant-elements/config";

const config: InstantElementsConfig = {
  /** 생성된 컴포넌트가 사는 곳. */
  elementsDir: ${JSON.stringify(options.elementsDir)},
  /** 앱에서 컴포넌트를 import 할 때 쓰는 별칭 — tsconfig paths 와 일치시켜 주세요. */
  importAlias: ${JSON.stringify(options.importAlias)},

  /** 레지스트리·페이지·흐름 데이터. 이 디렉토리를 커밋하면 하네스 전체가 팀에 공유됩니다. */
  registryDir: ${JSON.stringify(options.registryDir)},
  pagesDir: ${JSON.stringify(options.pagesDir)},
  flowsDir: ${JSON.stringify(options.flowsDir)},

  /** 우리 디자인 시스템 토큰으로 바꾸려면 이 경로를 프로젝트 CSS 로 가리키세요. */
  tokens: { css: "instant-elements/theme.css" },

  gallery: { port: 9221 },
};

export default config;
`;
}

export function defaultExportName(name: string): string {
  return pascalCase(name);
}
