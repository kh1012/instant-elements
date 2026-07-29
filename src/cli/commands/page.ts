import { readFileSync } from "node:fs";
import { flagBool, flagString } from "../args.js";
import { defineCommand, type CommandContext } from "../command.js";
import { readGitInfo } from "../project.js";
import { resolveConfig } from "../../config/resolve.js";
import type { ResolvedConfig } from "../../config/types.js";
import { buildIndex } from "../../registry/index-file.js";
import { tryReadEntry } from "../../registry/entry.js";
import {
  createPage,
  listPages,
  listSnapshots,
  readPage,
  readPageHistory,
  readSnapshot,
  savePage,
} from "../../page/store.js";
import { emptyPageData, type PageData } from "../../page/schema.js";
import { isBumpKind } from "../../page/version.js";
import { pageErrors, validatePageData, type PageIssue } from "../../page/validate.js";
import { listEntryNames } from "../../registry/entry.js";
import { isPageHistoryAction } from "../../page/schema.js";
import { CliError, color, emitJson, info, ok, warn } from "../ui.js";

async function loadConfig(ctx: CommandContext): Promise<ResolvedConfig> {
  const configFile = flagString(ctx.args.flags, "config");
  return resolveConfig({ cwd: ctx.cwd, ...(configFile ? { configFile } : {}) });
}

function storeOptions(config: ResolvedConfig) {
  return {
    pagesDir: config.pagesDir,
    actor: readGitInfo(config.root).userName ?? "unknown",
  };
}

function requireSlug(ctx: CommandContext, usage: string): string {
  const slug = ctx.args.positionals[1];
  if (!slug) throw new CliError("페이지 슬러그가 필요합니다.", { exitCode: 64, hint: usage });
  return slug;
}

async function runList(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const pages = listPages(config.pagesDir);

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({
      count: pages.length,
      pages: pages.map((p) => ({
        slug: p.slug,
        title: p.title,
        version: p.version,
        updatedAt: p.updatedAt,
        updatedBy: p.updatedBy,
        nodes: p.data.content.length,
      })),
    });
    return;
  }

  if (pages.length === 0) {
    info(color.dim("  아직 페이지가 없습니다 — `ie page create \"<제목>\"` 으로 만드세요."));
    return;
  }

  const width = Math.max(...pages.map((p) => p.slug.length));
  for (const page of pages) {
    info(
      `  ${color.bold(page.slug.padEnd(width))}  ${color.dim(`v${page.version}`.padEnd(10))}${page.title}`,
    );
  }
  info("");
  info(color.dim(`  ${pages.length}개`));
}

async function runGet(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie page get <slug>");
  const page = readPage(config.pagesDir, slug);

  // 기본이 JSON 이다 — 이 명령의 주 소비자는 편집을 준비하는 에이전트다.
  if (!flagBool(ctx.args.flags, "pretty")) {
    emitJson({ slug, version: page.version, title: page.title, data: page.data });
    return;
  }

  info(`  ${color.bold(page.title || slug)}  ${color.dim(`v${page.version}`)}`);
  info(`  ${color.dim(`최종 수정  ${page.updatedBy} · ${page.updatedAt}`)}`);
  info(`  ${color.dim(`최상위 노드  ${page.data.content.length}개`)}`);
}

async function runCreate(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const title = ctx.args.positionals[1];
  if (!title) {
    throw new CliError("제목이 필요합니다.", { exitCode: 64, hint: 'ie page create "대시보드"' });
  }

  const result = createPage(storeOptions(config), title, emptyPageData());

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({
      ...result,
      url: `http://${config.gallery.host}:${config.gallery.port}/pages/${result.slug}`,
    });
    return;
  }
  ok(`${result.slug} 생성 · v${result.version}`);
  info(
    `  ${color.cyan(`http://${config.gallery.host}:${config.gallery.port}/pages/${result.slug}`)}`,
  );
}

/** 레지스트리에서 알려진 이름과 렌더 가능한 이름을 모은다. */
function componentSets(config: ResolvedConfig) {
  const index = buildIndex({
    root: config.root,
    elementsDir: config.elementsDir,
    entriesDir: config.entriesDir,
    indexFile: config.indexFile,
  });
  return {
    knownComponents: new Set(listEntryNames({
      elementsDir: config.elementsDir,
      entriesDir: config.entriesDir,
    })),
    renderableComponents: new Set(index.components.filter((c) => c.hasDemo).map((c) => c.name)),
  };
}

function printIssues(issues: PageIssue[]): void {
  for (const issue of issues) {
    const mark = issue.level === "error" ? color.red("✗") : color.yellow("!");
    info(`  ${mark} ${color.dim(issue.path)}  ${issue.message}`);
    if (issue.hint) info(`      ${color.dim(issue.hint)}`);
  }
}

async function runCheck(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie page check <slug>");
  const page = readPage(config.pagesDir, slug);
  const issues = validatePageData(page.data, componentSets(config));
  const errors = pageErrors(issues);

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({ slug, issues, ok: errors.length === 0 });
    process.exitCode = errors.length === 0 ? 0 : 1;
    return;
  }
  printIssues(issues);
  if (errors.length > 0) {
    if (issues.length > 0) info("");
    warn(`오류 ${errors.length}건 · 경고 ${issues.length - errors.length}건`);
    process.exitCode = 1;
    return;
  }
  if (issues.length > 0) {
    info("");
    warn(`경고 ${issues.length}건 (오류 없음)`);
    return;
  }
  ok("페이지 구조 통과");
}

async function runSet(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, 'ie page set <slug> <file.json> --base <version> --note "…"');
  const file = ctx.args.positionals[2];
  if (!file) {
    throw new CliError("입력 파일이 필요합니다.", {
      exitCode: 64,
      hint: '{ "title"?: string, "data": <PageData> } 형태의 JSON 파일 경로를 주세요.',
    });
  }

  const base = flagString(ctx.args.flags, "base");
  if (!base) {
    throw new CliError("--base 가 필요합니다.", {
      exitCode: 64,
      hint: `직전 \`ie page get ${slug}\` 이 준 version 을 그대로 넣으세요. 통째로 덮어쓰기는 허용하지 않습니다.`,
    });
  }

  let parsed: { title?: string; data?: PageData };
  try {
    parsed = JSON.parse(readFileSync(file, "utf8")) as { title?: string; data?: PageData };
  } catch (err) {
    throw new CliError(`입력 파일을 읽지 못했습니다: ${file}`, {
      exitCode: 66,
      hint: err instanceof Error ? err.message : String(err),
    });
  }
  if (!parsed.data) {
    throw new CliError("입력 파일에 data 가 없습니다.", {
      exitCode: 65,
      hint: '{ "data": { "root": …, "content": [ … ] } }',
    });
  }

  const bump = flagString(ctx.args.flags, "bump");
  const action = flagString(ctx.args.flags, "action", "edited") as string;
  if (!isPageHistoryAction(action)) {
    throw new CliError(`--action 은 created|edited|refined|restored 중 하나여야 합니다: ${action}`, {
      exitCode: 64,
    });
  }

  // 저장 전에 구조를 검증한다 — 통과 못 한 데이터를 저장하고 딥링크까지 주면,
  // 화면이 조용히 비어 있는 것을 사람이 나중에 발견하게 된다.
  const issues = validatePageData(parsed.data, componentSets(config));
  const errors = pageErrors(issues);
  if (errors.length > 0 && !flagBool(ctx.args.flags, "force")) {
    printIssues(issues);
    throw new CliError(`페이지 구조 오류 ${errors.length}건 — 저장하지 않았습니다.`, {
      exitCode: 65,
      hint: "고친 뒤 다시 저장하세요. 정말 이대로 저장하려면 --force.",
    });
  }
  if (issues.length > 0) printIssues(issues);

  const result = savePage(storeOptions(config), {
    slug,
    base,
    data: parsed.data,
    ...(parsed.title ? { title: parsed.title } : {}),
    ...(bump && isBumpKind(bump) ? { bump } : {}),
    action,
    ...(flagString(ctx.args.flags, "note") ? { note: flagString(ctx.args.flags, "note") as string } : {}),
  });

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({
      ...result,
      url: `http://${config.gallery.host}:${config.gallery.port}/pages/${slug}`,
    });
    return;
  }
  ok(`${slug} 저장 · v${result.previous} → v${result.version}`);
  info(`  ${color.cyan(`http://${config.gallery.host}:${config.gallery.port}/pages/${slug}`)}`);
}

async function runHistory(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie page history <slug>");
  const events = readPageHistory(config.pagesDir, slug);

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({ slug, events });
    return;
  }
  for (const event of events) {
    info(
      `  ${color.dim(event.at)}  ${event.action.padEnd(9)}${color.dim(`v${event.version}`.padEnd(10))}${event.note ?? ""}`,
    );
  }
  if (events.length === 0) info(color.dim("  기록이 없습니다."));
}

async function runVersions(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie page versions <slug>");
  const versions = listSnapshots(config.pagesDir, slug);

  if (flagBool(ctx.args.flags, "json")) {
    const wanted = flagString(ctx.args.flags, "at");
    if (wanted) {
      const snapshot = readSnapshot(config.pagesDir, slug, wanted);
      if (!snapshot) throw new CliError(`스냅샷이 없습니다: ${slug}@${wanted}`, { exitCode: 66 });
      emitJson(snapshot);
      return;
    }
    emitJson({ slug, versions });
    return;
  }
  for (const version of versions) info(`  v${version}`);
  if (versions.length === 0) info(color.dim("  스냅샷이 없습니다."));
}

/**
 * 조립에 쓸 수 있는 컴포넌트 목록.
 *
 * 기본으로 **데모가 있는 것만** 준다 — 데모가 없으면 미리보기가 그리지 못해 페이지에 놓아도
 * 빈칸이 된다. 후보 단계에서 걸러야 조립하고 나서 발견하는 일이 없다.
 */
async function runCatalog(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const index = buildIndex({
    root: config.root,
    elementsDir: config.elementsDir,
    entriesDir: config.entriesDir,
    indexFile: config.indexFile,
  });

  const all = flagBool(ctx.args.flags, "all");
  const filtered = all ? index.components : index.components.filter((c) => c.hasDemo);

  // props 를 함께 싣는다 — GUIDE 가 "props 를 채우는 게 정상 경로" 라고 지시하는데,
  // 목록에 없으면 컴포넌트마다 `ie element get` 을 따로 불러야 한다.
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const components = filtered.map((component) => {
    const entry = tryReadEntry(dirs, component.name);
    return {
      ...component,
      props: entry?.meta.props ?? [],
      exportName: entry?.meta.exportName ?? null,
    };
  });

  if (flagBool(ctx.args.flags, "json") || !flagBool(ctx.args.flags, "pretty")) {
    emitJson({ count: components.length, components });
    return;
  }
  for (const component of components) {
    info(`  ${color.bold(component.name)}  ${color.dim(component.category)}  ${component.summary}`);
  }
}

export const pageCommand = defineCommand({
  name: "page",
  summary: "페이지를 만들고 조립하고 이력을 남긴다",
  usage: "ie page <list|get|create|set|history|versions|catalog> [args]",
  details: [
    'create "<제목>"        빈 페이지 생성 → {slug, version}',
    "get <slug>            {version, title, data} (기본 JSON · --pretty 로 요약)",
    "set <slug> <file>     --base <version> [--bump patch|minor|major]",
    '                      [--action edited|refined] [--note "한 일"]',
    "                      --base 가 최신과 다르면 종료코드 4 로 거부합니다(덮어쓰기 금지).",
    "check <slug>          구조 검증(id 유일·items·알려진 컴포넌트)",
    "history <slug>        편집 이력(최신순)",
    "versions <slug>       스냅샷 목록 · --at <version> 으로 그 시점 내용",
    "catalog [--all]       조립 가능 컴포넌트(기본 = 데모 보유 = 렌더 가능)",
  ],
  async run(ctx) {
    const sub = ctx.args.positionals[0];
    switch (sub) {
      case "list":
        return runList(ctx);
      case "get":
        return runGet(ctx);
      case "create":
        return runCreate(ctx);
      case "set":
        return runSet(ctx);
      case "check":
        return runCheck(ctx);
      case "history":
        return runHistory(ctx);
      case "versions":
        return runVersions(ctx);
      case "catalog":
        return runCatalog(ctx);
      default:
        throw new CliError(`알 수 없는 하위 명령: ${sub ?? "(없음)"}`, {
          exitCode: 64,
          hint: "사용 가능: list · get · create · set · check · history · versions · catalog",
        });
    }
  },
});
