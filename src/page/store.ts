import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "../cli/ui.js";
import { appendLine, readJsonClassified, readJsonl, writeJsonAtomic } from "../registry/io.js";
import { withFileLock } from "./lock.js";
import {
  emptyPageData,
  isPageHistoryAction,
  type PageData,
  type PageFile,
  type PageHistoryAction,
  type PageHistoryEvent,
} from "./schema.js";
import { fileIn, isValidSlug, normalizeSlug, slugify } from "./slug.js";
import { bumpVersion, compareVersions, INITIAL_VERSION, migrateVersion, type BumpKind } from "./version.js";

export interface PageStoreOptions {
  pagesDir: string;
  actor: string;
}

function pagePath(pagesDir: string, slug: string): string {
  const path = fileIn(pagesDir, slug, ".json");
  if (!path) {
    throw new CliError(`잘못된 페이지 슬러그: ${JSON.stringify(slug)}`, {
      exitCode: 64,
      hint: "소문자·숫자·하이픈·한글만 쓸 수 있습니다.",
    });
  }
  return path;
}

function historyPath(pagesDir: string, slug: string): string | null {
  return fileIn(pagesDir, slug, ".history.jsonl");
}

/** 스냅샷 디렉토리 — 흐름이 "편입 시점의 페이지"를 박제해 두는 자리(Phase 3). */
export function snapshotPath(pagesDir: string, slug: string, version: string): string | null {
  if (!isValidSlug(slug) || !/^\d+\.\d+\.\d+$/.test(version)) return null;
  return join(pagesDir, ".versions", normalizeSlug(slug), `${version}.json`);
}

function normalizePage(raw: unknown): PageFile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o["version"] === undefined) return null;
  const data = (o["data"] ?? {}) as Partial<PageData>;
  return {
    version: migrateVersion(o["version"]),
    title: typeof o["title"] === "string" ? o["title"] : "",
    updatedAt: typeof o["updatedAt"] === "string" ? o["updatedAt"] : "",
    updatedBy: typeof o["updatedBy"] === "string" ? o["updatedBy"] : "",
    data: {
      root: data.root ?? { props: {} },
      content: Array.isArray(data.content) ? data.content : [],
      zones: data.zones ?? {},
    },
  };
}

/** 목록 항목은 파일명에서 파생한 슬러그를 함께 싣는다 — 페이지 파일 자체는 자기 이름을 모른다. */
export type PageSummary = PageFile & { slug: string };

export function listPages(pagesDir: string): PageSummary[] {
  let files: string[];
  try {
    files = readdirSync(pagesDir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".json") && !f.endsWith(".feedback.json"))
    .map((f) => normalizeSlug(f.slice(0, -".json".length)))
    .filter(isValidSlug)
    .map((slug) => {
      const page = tryReadPage(pagesDir, slug);
      return page ? { ...page, slug } : null;
    })
    .filter((p): p is PageSummary => p !== null)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function pageExists(pagesDir: string, slug: string): boolean {
  return isValidSlug(slug) && existsSync(pagePath(pagesDir, slug));
}

export function readPage(pagesDir: string, slug: string): PageFile {
  const path = pagePath(pagesDir, slug);
  const result = readJsonClassified<unknown>(path);

  if (result.status === "missing") {
    throw new CliError(`페이지를 찾을 수 없습니다: ${slug}`, {
      exitCode: 66,
      hint: "`ie page list` 로 목록을 확인하세요.",
    });
  }
  if (result.status === "corrupt") {
    // 손상을 '없음'으로 뭉개면 다음 저장이 신규로 덮어써 내용을 통째로 날린다.
    throw new CliError(`페이지 JSON 이 손상됐습니다: ${slug}`, {
      exitCode: 65,
      hint: `${path} — ${result.error}`,
    });
  }

  const page = normalizePage(result.value);
  if (!page) throw new CliError(`페이지 형식이 올바르지 않습니다: ${slug}`, { exitCode: 65 });
  return page;
}

export function tryReadPage(pagesDir: string, slug: string): PageFile | null {
  try {
    return readPage(pagesDir, slug);
  } catch {
    return null;
  }
}

export function appendPageHistory(
  pagesDir: string,
  slug: string,
  event: PageHistoryEvent,
): void {
  const path = historyPath(pagesDir, slug);
  if (path) appendLine(path, JSON.stringify(event));
}

export function readPageHistory(pagesDir: string, slug: string): PageHistoryEvent[] {
  const path = historyPath(pagesDir, slug);
  if (!path) return [];
  const out: PageHistoryEvent[] = [];
  for (const item of readJsonl<Record<string, unknown>>(path)) {
    if (typeof item["at"] !== "string" || typeof item["actor"] !== "string") continue;
    if (!isPageHistoryAction(item["action"])) continue;
    out.push({
      at: item["at"],
      actor: item["actor"],
      action: item["action"],
      ...(typeof item["note"] === "string" ? { note: item["note"] } : {}),
      version: migrateVersion(item["version"]),
    });
  }
  return out.reverse();
}

export interface CreatePageResult {
  slug: string;
  version: string;
  path: string;
}

/**
 * 빈 페이지를 만든다.
 *
 * 슬러그가 이미 있으면 뒤에 숫자를 붙인다 — 제목이 겹쳤다고 남의 페이지를 덮어쓰면 안 되고,
 * 그렇다고 실패로 막으면 "대시보드" 같은 흔한 제목을 아무도 두 번 못 쓴다.
 */
export function createPage(
  options: PageStoreOptions,
  title: string,
  data: PageData = emptyPageData(),
): CreatePageResult {
  const { pagesDir, actor } = options;
  const base = slugify(title);

  let slug = base;
  for (let i = 2; pageExists(pagesDir, slug); i += 1) slug = `${base}-${i}`;

  const path = pagePath(pagesDir, slug);
  const at = new Date().toISOString();
  const page: PageFile = {
    version: INITIAL_VERSION,
    title: title.trim() || slug,
    updatedAt: at,
    updatedBy: actor,
    data,
  };

  return withFileLock(path, () => {
    writeJsonAtomic(path, page);
    writeSnapshot(pagesDir, slug, page);
    appendPageHistory(pagesDir, slug, {
      at,
      actor,
      action: "created",
      version: INITIAL_VERSION,
    });
    return { slug, version: INITIAL_VERSION, path };
  });
}

export interface SavePageInput {
  slug: string;
  /** 직전 `read` 에서 받은 버전. 이게 최신과 다르면 저장을 거부한다. */
  base: string;
  data: PageData;
  title?: string;
  bump?: BumpKind;
  action?: PageHistoryAction;
  note?: string;
}

export interface SavePageResult {
  slug: string;
  version: string;
  previous: string;
}

/** 버전 충돌 — 호출자가 최신본을 다시 읽고 내 변경을 재적용해야 한다는 신호. */
export class PageConflictError extends CliError {
  readonly current: string;
  readonly base: string;

  constructor(slug: string, base: string, current: string) {
    super(`페이지가 그 사이 바뀌었습니다: ${slug}`, {
      exitCode: 4,
      hint: `읽은 버전 ${base}, 현재 ${current} — \`ie page get ${slug}\` 로 최신본을 받아 변경을 다시 적용하세요.`,
    });
    this.name = "PageConflictError";
    this.current = current;
    this.base = base;
  }
}

/**
 * 페이지를 저장한다 — 낙관적 동시성.
 *
 * 읽기와 쓰기 사이에 남이 저장했으면 **거부**한다(종료코드 4). 통째로 덮어쓰게 두면 리뷰어의
 * 손편집이나 다른 에이전트의 리파인이 조용히 사라진다. 락 안에서 다시 읽어 검사하므로
 * 검사와 쓰기 사이에 끼어들 틈도 없다.
 */
export function savePage(options: PageStoreOptions, input: SavePageInput): SavePageResult {
  const { pagesDir, actor } = options;
  const path = pagePath(pagesDir, input.slug);

  return withFileLock(path, () => {
    const current = readPage(pagesDir, input.slug);
    if (current.version !== input.base) {
      throw new PageConflictError(input.slug, input.base, current.version);
    }

    const version = bumpVersion(current.version, input.bump ?? "patch");
    const at = new Date().toISOString();
    const page: PageFile = {
      version,
      title: input.title?.trim() || current.title,
      updatedAt: at,
      updatedBy: actor,
      data: input.data,
    };

    writeJsonAtomic(path, page);
    writeSnapshot(pagesDir, input.slug, page);
    appendPageHistory(pagesDir, input.slug, {
      at,
      actor,
      action: input.action ?? "edited",
      ...(input.note ? { note: input.note } : {}),
      version,
    });

    return { slug: input.slug, version, previous: current.version };
  });
}

/**
 * 버전 스냅샷을 남긴다.
 *
 * 흐름(Phase 3)이 "편입 시점의 화면"을 박제해야 하기 때문이다 — 페이지를 리파인해도 진행 중인
 * 시연이 흔들리면 안 된다. 복원 기능의 대상이기도 하다.
 */
export function writeSnapshot(pagesDir: string, slug: string, page: PageFile): void {
  const path = snapshotPath(pagesDir, slug, page.version);
  if (path) writeJsonAtomic(path, page);
}

export function listSnapshots(pagesDir: string, slug: string): string[] {
  if (!isValidSlug(slug)) return [];
  try {
    return readdirSync(join(pagesDir, ".versions", normalizeSlug(slug)))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
      .sort((a, b) => compareVersions(b, a));
  } catch {
    return [];
  }
}

export function readSnapshot(pagesDir: string, slug: string, version: string): PageFile | null {
  const path = snapshotPath(pagesDir, slug, version);
  if (!path) return null;
  const result = readJsonClassified<unknown>(path);
  return result.status === "ok" ? normalizePage(result.value) : null;
}
