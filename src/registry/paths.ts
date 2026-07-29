import { basename, join, resolve } from "node:path";
import { CliError } from "../cli/ui.js";

/**
 * 컴포넌트 이름 규칙 — kebab-case.
 *
 * 이 하나의 이름이 디렉토리명·파일명·엔트리 파일명·URL 슬러그·import 경로에 동시에 쓰인다.
 * 그래서 파일시스템·URL 양쪽에서 안전한 최소 교집합만 허용한다: 소문자·숫자·하이픈.
 * `.`·`/`·`\` 를 문자 집합에 넣지 않으므로 `..` 나 하위경로가 **구조적으로** 불가능하다.
 */
export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/;

export function isValidName(name: string): boolean {
  return NAME_RE.test(name);
}

export function assertValidName(name: string): string {
  if (!isValidName(name)) {
    throw new CliError(`잘못된 컴포넌트 이름: ${JSON.stringify(name)}`, {
      exitCode: 64,
      hint: "소문자·숫자·하이픈만, 하이픈으로 시작하거나 끝날 수 없습니다. 예: stat-card",
    });
  }
  return name;
}

/**
 * `<dir>/<name><ext>` 절대경로. 디렉토리 봉쇄로 traversal 을 차단한다.
 *
 * NAME_RE 가 이미 대부분을 막지만, 검증을 건너뛴 호출자가 생겨도 여기서 한 번 더 걸리도록
 * 경로 계산 시점에 실제 해석 결과를 다시 확인한다(방어 이중화).
 */
export function fileIn(dir: string, name: string, ext: string): string {
  assertValidName(name);
  const filename = `${name}${ext}`;
  const path = resolve(dir, filename);
  if (resolve(dir) !== resolve(path, "..") || basename(path) !== filename) {
    throw new CliError(`경로를 만들 수 없습니다: ${name}`, { exitCode: 64 });
  }
  return path;
}

export interface ElementPaths {
  /** 컴포넌트 3파일이 사는 디렉토리. */
  dir: string;
  /** 컴포넌트 본체. */
  component: string;
  /** 갤러리 프리뷰용 데모(default export). */
  demo: string;
  /** 배럴. */
  index: string;
  /** 레지스트리 엔트리 JSON. */
  entry: string;
  /** 히스토리 사이드카(append-only). */
  history: string;
}

export interface RegistryDirs {
  elementsDir: string;
  entriesDir: string;
}

export function elementPaths(dirs: RegistryDirs, name: string): ElementPaths {
  assertValidName(name);
  const dir = fileIn(dirs.elementsDir, name, "");
  return {
    dir,
    component: join(dir, `${name}.tsx`),
    demo: join(dir, `${name}.demo.tsx`),
    index: join(dir, "index.ts"),
    entry: fileIn(dirs.entriesDir, name, ".json"),
    history: fileIn(dirs.entriesDir, name, ".history.jsonl"),
  };
}

/** kebab-case → PascalCase. export 이름과 스토리 제목이 여기서 파생된다. */
export function pascalCase(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
