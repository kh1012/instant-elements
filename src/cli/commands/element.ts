import { readFileSync } from "node:fs";
import { flagBool, flagList, flagString } from "../args.js";
import { defineCommand, type CommandContext } from "../command.js";
import { readGitInfo } from "../project.js";
import { resolveConfig } from "../../config/resolve.js";
import type { ResolvedConfig } from "../../config/types.js";
import { createElement } from "../../registry/create.js";
import { listEntries, readEntry, validateEntry } from "../../registry/entry.js";
import { appendHistory, isHistoryAction, readHistory } from "../../registry/history.js";
import { buildIndex } from "../../registry/index-file.js";
import { isCategory, isStatus } from "../../registry/schema.js";
import { applySchema, computeSchema } from "../../schema/apply.js";
import { listEntryNames } from "../../registry/entry.js";
import { CliError, color, emitJson, info, ok, warn } from "../ui.js";

/** `--x` 또는 `--x-file` 로 값을 받는다. 긴 원문(줄바꿈·코드펜스)은 파일 경로가 안전하다. */
function textOption(
  ctx: CommandContext,
  key: string,
): string | undefined {
  const inline = flagString(ctx.args.flags, key);
  if (inline !== undefined) return inline;
  const file = flagString(ctx.args.flags, `${key}-file`);
  if (file === undefined) return undefined;
  try {
    return readFileSync(file, "utf8").replace(/\n+$/, "");
  } catch (err) {
    throw new CliError(`--${key}-file 을 읽지 못했습니다: ${file}`, {
      exitCode: 66,
      hint: err instanceof Error ? err.message : String(err),
    });
  }
}

function requireText(ctx: CommandContext, key: string, why: string): string {
  const value = textOption(ctx, key)?.trim();
  if (!value) {
    throw new CliError(`--${key} 가 필요합니다.`, { exitCode: 64, hint: why });
  }
  return value;
}

async function loadConfig(ctx: CommandContext): Promise<ResolvedConfig> {
  const configFile = flagString(ctx.args.flags, "config");
  return resolveConfig({ cwd: ctx.cwd, ...(configFile ? { configFile } : {}) });
}

function actorOf(root: string): string {
  return readGitInfo(root).userName ?? "unknown";
}

async function runNew(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const name = ctx.args.positionals[1];
  if (!name) throw new CliError("컴포넌트 이름이 필요합니다.", { exitCode: 64, hint: "ie element new <name> --intent … --summary …" });

  const category = flagString(ctx.args.flags, "category", "Composite") as string;
  if (!isCategory(category))
    throw new CliError(`--category 는 Composite|Animations|System 중 하나여야 합니다: ${category}`, {
      exitCode: 64,
    });

  const status = flagString(ctx.args.flags, "status", "draft") as string;
  if (!isStatus(status))
    throw new CliError(`--status 는 draft|stable 중 하나여야 합니다: ${status}`, { exitCode: 64 });

  const result = createElement(config, {
    name,
    intent: requireText(ctx, "intent", "무엇을 왜 만들라고 했는지 원문 그대로 남깁니다."),
    summary: requireText(
      ctx,
      "summary",
      "카드·상세에 보여줄 담백한 한 문장. 개발 용어 없이 누가 읽어도 이해되게 씁니다.",
    ),
    category,
    status,
    keywords: flagList(ctx.args.flags, "keywords"),
    createdBy: actorOf(config.root),
    ...(flagString(ctx.args.flags, "export-name")
      ? { exportName: flagString(ctx.args.flags, "export-name") as string }
      : {}),
    force: flagBool(ctx.args.flags, "force"),
  });

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({
      name: result.entry.name,
      entry: result.entry,
      written: result.written,
      indexCount: result.indexCount,
      gallery: `http://${config.gallery.host}:${config.gallery.port}/c/${result.entry.name}`,
    });
    return;
  }

  ok(`${result.entry.name} 생성 · ${result.indexCount}개 엔트리`);
  for (const file of result.written) info(`  ${color.dim(file)}`);
  info("");
  info(`  갤러리  ${color.cyan(`http://${config.gallery.host}:${config.gallery.port}/c/${result.entry.name}`)}`);
  info(`  ${color.dim("`ie gallery` 로 띄운 뒤 열어 확인하세요.")}`);
}

async function runList(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const index = buildIndex({
    root: config.root,
    elementsDir: config.elementsDir,
    entriesDir: config.entriesDir,
    indexFile: config.indexFile,
  });

  const category = flagString(ctx.args.flags, "category");
  const status = flagString(ctx.args.flags, "status");
  const query = flagString(ctx.args.flags, "query")?.toLowerCase();

  let components = index.components;
  if (category) components = components.filter((c) => c.category === category);
  if (status) components = components.filter((c) => c.status === status);
  if (query) {
    components = components.filter((c) =>
      [c.name, c.intent, c.summary, ...c.keywords].join(" ").toLowerCase().includes(query),
    );
  }

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({ count: components.length, components });
    return;
  }

  if (components.length === 0) {
    warn("조건에 맞는 컴포넌트가 없습니다.");
    return;
  }

  const width = Math.max(...components.map((c) => c.name.length));
  for (const component of components) {
    const badge = component.hasDemo ? "" : color.dim(" (데모 없음)");
    info(
      `  ${color.bold(component.name.padEnd(width))}  ${color.dim(
        `${component.category}/${component.status}`.padEnd(18),
      )}${component.summary || component.intent}${badge}`,
    );
  }
  info("");
  info(color.dim(`  ${components.length}개`));
}

async function runGet(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const name = ctx.args.positionals[1];
  if (!name) throw new CliError("컴포넌트 이름이 필요합니다.", { exitCode: 64, hint: "ie element get <name>" });

  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const entry = readEntry(dirs, name);
  const history = readHistory(dirs, name);
  const problems = validateEntry(entry);

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({ entry, history, problems });
    return;
  }

  info("");
  info(`  ${color.bold(entry.name)}  ${color.dim(`${entry.meta.category}/${entry.meta.status}`)}`);
  info(`  ${entry.meta.summary}`);
  info("");
  info(`  ${color.dim("역할")}      ${entry.meta.intent}`);
  info(`  ${color.dim("import")}    { ${entry.meta.exportName} } from "${config.importAlias}/${entry.name}"`);
  info(`  ${color.dim("코드")}      ${entry.files[0]?.path ?? "-"}`);
  info(`  ${color.dim("검색어")}    ${entry.meta.keywords.join(", ")}`);
  info(`  ${color.dim("만든이")}    ${entry.meta.createdBy} · ${entry.meta.createdAt}`);
  info("");
  info(`  ${color.bold("히스토리")} ${color.dim(`${history.length}건`)}`);
  for (const event of history.slice(0, 10)) {
    const sha = event.sha ? color.dim(` @${event.sha.slice(0, 7)}`) : "";
    info(`    ${color.dim(event.at)}  ${event.action}${sha}  ${event.note ?? event.prompt ?? ""}`);
  }
  if (problems.length > 0) {
    info("");
    for (const problem of problems) warn(`  ${problem}`);
  }
}

async function runLog(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const name = ctx.args.positionals[1];
  if (!name) throw new CliError("컴포넌트 이름이 필요합니다.", { exitCode: 64, hint: "ie element log <name> --action modified --note …" });

  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  readEntry(dirs, name); // 존재 확인 — 없는 이름으로 이력만 쌓이지 않게.

  const action = flagString(ctx.args.flags, "action", "modified") as string;
  if (!isHistoryAction(action))
    throw new CliError(`--action 은 created|modified|recommended 중 하나여야 합니다: ${action}`, {
      exitCode: 64,
    });

  const event = {
    at: new Date().toISOString(),
    actor: actorOf(config.root),
    action,
    ...(textOption(ctx, "prompt") ? { prompt: textOption(ctx, "prompt") as string } : {}),
    ...(flagString(ctx.args.flags, "note") ? { note: flagString(ctx.args.flags, "note") as string } : {}),
    ...(flagString(ctx.args.flags, "sha") ? { sha: flagString(ctx.args.flags, "sha") as string } : {}),
  };

  appendHistory(dirs, name, event);

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({ name, event });
    return;
  }
  ok(`${name} · ${action} 기록`);
  if (event.note) info(`  ${color.dim(event.note)}`);
}

/**
 * props 스키마 추출·백필.
 *
 * 이 스키마는 문서용이 아니다 — 페이지 조립이 이걸 읽어 실 컴포넌트에 값을 넘긴다. 코드와
 * 어긋나면 페이지가 없는 prop 을 넘기거나 있는 prop 을 못 채운다. `--check` 로 CI 에서 잡는다.
 */
async function runSchema(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const only = ctx.args.positionals[1];
  const names = only ? [only] : listEntryNames(dirs);
  const check = flagBool(ctx.args.flags, "check");

  const results = names.map((name) => computeSchema(config, name));
  const drifted = results.filter((r) => !r.inSync);
  const missing = results.filter((r) => !r.found);

  if (!check) {
    for (const result of drifted) applySchema(config, result);
  }

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({
      checked: results.length,
      drifted: drifted.map((r) => ({ name: r.name, current: r.current, extracted: r.extracted })),
      missing: missing.map((r) => r.name),
      applied: check ? [] : drifted.map((r) => r.name),
    });
    process.exitCode = check && drifted.length > 0 ? 1 : 0;
    return;
  }

  if (drifted.length === 0) {
    ok(`${results.length}개 확인 · 스키마가 코드와 일치합니다.`);
  } else if (check) {
    warn(`${drifted.length}개가 코드와 어긋납니다 — \`ie element schema\` 로 갱신하세요.`);
    for (const result of drifted) {
      info(`  ${color.bold(result.name)}  ${result.current.length}개 → ${result.extracted.length}개`);
    }
    process.exitCode = 1;
  } else {
    ok(`${drifted.length}개 갱신`);
    for (const result of drifted) {
      info(`  ${color.bold(result.name)}  ${result.extracted.map((p) => p.name).join(", ") || "(없음)"}`);
    }
  }

  for (const result of missing) {
    info(`  ${color.dim(`${result.name} — Props 타입을 찾지 못했습니다(추측하지 않습니다).`)}`);
  }
}

export const elementCommand = defineCommand({
  name: "element",
  summary: "컴포넌트를 만들고 조회하고 이력을 남긴다",
  usage: "ie element <new|list|get|log> [args]",
  details: [
    "new <name>   --intent <원문> --summary <한 문장> [--category Composite|Animations|System]",
    "             [--keywords a,b] [--export-name X] [--force]",
    "             긴 원문은 --intent-file <경로> 로 줄 수 있습니다.",
    "list         [--category X] [--status draft|stable] [--query 검색어] [--json]",
    "get <name>   엔트리 + 히스토리 + 계약 검사 [--json]",
    "log <name>   --action modified|recommended [--note …] [--prompt-file …] [--sha …]",
    "schema [name] TS Props 타입에서 props 스키마를 추출해 엔트리에 백필 [--check] [--json]",
  ],
  async run(ctx) {
    const sub = ctx.args.positionals[0];
    switch (sub) {
      case "new":
        return runNew(ctx);
      case "list":
        return runList(ctx);
      case "get":
        return runGet(ctx);
      case "log":
        return runLog(ctx);
      case "schema":
        return runSchema(ctx);
      default:
        throw new CliError(`알 수 없는 하위 명령: ${sub ?? "(없음)"}`, {
          exitCode: 64,
          hint: "사용 가능: new · list · get · log · schema — `ie help element` 로 상세 도움말.",
        });
    }
  },
});
