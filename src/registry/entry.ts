import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "../cli/ui.js";
import { readJsonClassified, writeJsonAtomic } from "./io.js";
import { assertValidName, elementPaths, isValidName, type RegistryDirs } from "./paths.js";
import { isCategory, isStatus, type Entry } from "./schema.js";

/** 엔트리 JSON 을 읽고 최소 계약을 확인한다. 손상과 부재를 구분해 던진다. */
export function readEntry(dirs: RegistryDirs, name: string): Entry {
  assertValidName(name);
  const path = elementPaths(dirs, name).entry;
  const result = readJsonClassified<Entry>(path);

  if (result.status === "missing") {
    throw new CliError(`엔트리를 찾을 수 없습니다: ${name}`, {
      exitCode: 66,
      hint: `${path} 가 없습니다. \`ie element list\` 로 등록된 이름을 확인하세요.`,
    });
  }
  if (result.status === "corrupt") {
    throw new CliError(`엔트리 JSON 이 손상됐습니다: ${name}`, {
      exitCode: 65,
      hint: `${path} — ${result.error}`,
    });
  }

  const entry = result.value;
  if (entry?.name !== name) {
    throw new CliError(`엔트리의 name 이 파일명과 다릅니다: ${name}`, {
      exitCode: 65,
      hint: `파일은 ${name}.json 인데 name 은 ${JSON.stringify(entry?.name)} 입니다.`,
    });
  }
  return entry;
}

/** 읽되 없거나 손상이면 null. 목록처럼 "하나가 깨져도 전체가 죽으면 안 되는" 곳에서 쓴다. */
export function tryReadEntry(dirs: RegistryDirs, name: string): Entry | null {
  try {
    return readEntry(dirs, name);
  } catch {
    return null;
  }
}

export function entryExists(dirs: RegistryDirs, name: string): boolean {
  return isValidName(name) && existsSync(elementPaths(dirs, name).entry);
}

export function writeEntry(dirs: RegistryDirs, entry: Entry): void {
  assertValidName(entry.name);
  writeJsonAtomic(elementPaths(dirs, entry.name).entry, entry);
}

/**
 * 등록된 엔트리 이름 목록(사전순).
 *
 * `*.history.jsonl` 은 확장자가 달라 자연히 제외된다. 디렉토리가 아예 없으면 빈 목록 —
 * 아직 아무것도 만들지 않은 프로젝트는 오류가 아니라 정상 상태다.
 */
export function listEntryNames(dirs: RegistryDirs): string[] {
  let files: string[];
  try {
    files = readdirSync(dirs.entriesDir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .filter(isValidName)
    .sort((a, b) => a.localeCompare(b));
}

export function listEntries(dirs: RegistryDirs): Entry[] {
  return listEntryNames(dirs)
    .map((name) => tryReadEntry(dirs, name))
    .filter((e): e is Entry => e !== null);
}

/**
 * 엔트리가 실제로 렌더 가능한가 = 데모 파일이 있는가.
 *
 * 페이지 조립이 이 판정으로 후보를 거른다. 데모 없는 엔트리를 노드로 쓰면 미리보기가
 * "미해결 컴포넌트"로 격하되므로, 카탈로그 단계에서 미리 걸러야 한다.
 */
export function hasDemo(dirs: RegistryDirs & { root: string }, entry: Entry): boolean {
  if (entry.meta.demo) return existsSync(join(dirs.root, entry.meta.demo));
  return existsSync(elementPaths(dirs, entry.name).demo);
}

/** 엔트리 최소 계약 검사 — 필수 필드 누락을 사람이 읽는 메시지로 알린다. */
export function validateEntry(entry: Entry): string[] {
  const problems: string[] = [];
  if (!entry.name || !isValidName(entry.name)) problems.push("name 이 kebab-case 가 아닙니다.");
  if (!entry.description?.trim()) problems.push("description 이 비어 있습니다.");
  if (!Array.isArray(entry.files) || entry.files.length === 0)
    problems.push("files 가 비어 있습니다.");
  const meta = entry.meta;
  if (!meta) {
    problems.push("meta 가 없습니다.");
    return problems;
  }
  if (!isStatus(meta.status)) problems.push(`meta.status 가 draft|stable 이 아닙니다: ${meta.status}`);
  if (!isCategory(meta.category))
    problems.push(`meta.category 가 Composite|Animations|System 이 아닙니다: ${meta.category}`);
  if (!meta.intent?.trim()) problems.push("meta.intent 가 비어 있습니다.");
  if (!meta.summary?.trim()) problems.push("meta.summary 가 비어 있습니다.");
  if (!Array.isArray(meta.keywords) || meta.keywords.length === 0)
    problems.push("meta.keywords 가 비어 있습니다.");
  if (!meta.createdAt?.trim()) problems.push("meta.createdAt 이 비어 있습니다.");
  return problems;
}
