import { flagBool, flagString } from "../args.js";
import { defineCommand, type CommandContext } from "../command.js";
import { readGitInfo } from "../project.js";
import { resolveConfig } from "../../config/resolve.js";
import type { ResolvedConfig } from "../../config/types.js";
import { createFlow, listFlows, readFlow, writeFlow } from "../../flow/store.js";
import { checkFlowIntegrity } from "../../flow/schema.js";
import { readPage } from "../../page/store.js";
import type { PageNode } from "../../page/schema.js";
import { CliError, color, emitJson, info, ok, warn } from "../ui.js";

async function loadConfig(ctx: CommandContext): Promise<ResolvedConfig> {
  const configFile = flagString(ctx.args.flags, "config");
  return resolveConfig({ cwd: ctx.cwd, ...(configFile ? { configFile } : {}) });
}

function storeOptions(config: ResolvedConfig) {
  return { flowsDir: config.flowsDir, actor: readGitInfo(config.root).userName ?? "unknown" };
}

function requireSlug(ctx: CommandContext, usage: string): string {
  const slug = ctx.args.positionals[1];
  if (!slug) throw new CliError("흐름 슬러그가 필요합니다.", { exitCode: 64, hint: usage });
  return slug;
}

/** 페이지의 모든 노드 id 를 모은다 — 흐름이 가리킬 수 있는 자리의 전부다. */
function collectNodeIds(nodes: PageNode[], out = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.props.id) out.add(node.props.id);
    if (node.props.items?.length) collectNodeIds(node.props.items, out);
  }
  return out;
}

async function runList(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const flows = listFlows(config.flowsDir);

  if (flagBool(ctx.args.flags, "json")) {
    return emitJson({
      count: flows.length,
      flows: flows.map((f) => ({
        slug: f.slug,
        name: f.name,
        screens: f.screens.length,
        edges: f.edges.length,
        updatedAt: f.updatedAt,
      })),
    });
  }
  if (flows.length === 0) {
    return info(color.dim('  아직 흐름이 없습니다 — `ie flow create "<이름>"` 으로 만드세요.'));
  }
  for (const flow of flows) {
    info(
      `  ${color.bold(flow.slug)}  ${color.dim(`화면 ${flow.screens.length} · 연결 ${flow.edges.length}`)}  ${flow.name}`,
    );
  }
}

async function runCreate(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const name = ctx.args.positionals[1];
  if (!name) throw new CliError("이름이 필요합니다.", { exitCode: 64, hint: 'ie flow create "온보딩"' });

  const result = createFlow(storeOptions(config), name);
  if (flagBool(ctx.args.flags, "json")) return emitJson(result);
  ok(`${result.slug} 생성`);
  info(`  ${color.cyan(`http://${config.gallery.host}:${config.gallery.port}/flows/${result.slug}`)}`);
}

/**
 * 화면을 흐름에 편입한다.
 *
 * **편입 시점의 버전을 박제**한다 — 페이지를 리파인해도 진행 중인 시연이 흔들리지 않는다.
 * 최신본을 쓰려면 `--refresh` 로 다시 편입한다.
 */
async function runAdd(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie flow add <flow> --screen <page-slug>");
  const screen = flagString(ctx.args.flags, "screen");
  if (!screen) throw new CliError("--screen 이 필요합니다.", { exitCode: 64 });

  const page = readPage(config.pagesDir, screen);
  const flow = writeFlow(storeOptions(config), slug, (current) => {
    const others = current.screens.filter((s) => s.slug !== screen);
    return {
      ...current,
      screens: [...others, { slug: screen, version: page.version }],
      start: current.start ?? screen,
    };
  });

  if (flagBool(ctx.args.flags, "json")) return emitJson(flow);
  ok(`${screen} 편입 · v${page.version} 로 박제`);
}

/** 화면 전환을 잇는다. */
async function runLink(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie flow link <flow> --from <page:node> --to <page>");
  const from = flagString(ctx.args.flags, "from");
  const to = flagString(ctx.args.flags, "to");
  if (!from || !to) {
    throw new CliError("--from 과 --to 가 필요합니다.", {
      exitCode: 64,
      hint: '--from "대시보드:P-chart" --to "상세" [--action onTabChange] [--value overview]',
    });
  }

  const [fromSlug, nodeId] = from.split(":");
  if (!fromSlug || !nodeId) {
    throw new CliError('--from 은 "<page-slug>:<node-id>" 형태여야 합니다.', { exitCode: 64 });
  }

  const action = flagString(ctx.args.flags, "action");
  const value = flagString(ctx.args.flags, "value");
  const id = `${fromSlug}:${nodeId}${action ? `:${action}` : ""}${value ? `=${value}` : ""}→${to}`;

  const flow = writeFlow(storeOptions(config), slug, (current) => ({
    ...current,
    edges: [
      ...current.edges.filter((e) => e.id !== id),
      {
        id,
        from: {
          slug: fromSlug,
          nodeId,
          ...(action ? { action } : {}),
          ...(value ? { value } : {}),
        },
        to,
      },
    ],
  }));

  if (flagBool(ctx.args.flags, "json")) return emitJson(flow);
  ok(`${fromSlug}/${nodeId} → ${to}`);
}

async function runCheck(ctx: CommandContext): Promise<void> {
  const config = await loadConfig(ctx);
  const slug = requireSlug(ctx, "ie flow check <flow>");
  const flow = readFlow(config.flowsDir, slug);

  const nodeIdsByScreen: Record<string, Set<string>> = {};
  for (const screen of flow.screens) {
    try {
      nodeIdsByScreen[screen.slug] = collectNodeIds(readPage(config.pagesDir, screen.slug).data.content);
    } catch {
      // 페이지가 사라졌으면 노드 검사를 건너뛴다 — 그 사실 자체는 아래 정합성 검사가 잡는다.
    }
  }

  const issues = checkFlowIntegrity(flow, nodeIdsByScreen);
  const errors = issues.filter((i) => i.level === "error");

  if (flagBool(ctx.args.flags, "json")) {
    emitJson({ slug, issues, ok: errors.length === 0 });
    process.exitCode = errors.length === 0 ? 0 : 1;
    return;
  }
  for (const issue of issues) {
    const mark = issue.level === "error" ? color.red("✗") : color.yellow("!");
    info(`  ${mark} ${issue.message}`);
  }
  if (errors.length > 0) {
    warn(`오류 ${errors.length}건 — 시연 중 넘어가지 않는 자리가 있습니다.`);
    process.exitCode = 1;
    return;
  }
  ok(issues.length === 0 ? "정합성 통과" : `경고 ${issues.length}건 (오류 없음)`);
}

export const flowCommand = defineCommand({
  name: "flow",
  summary: "페이지를 이어 화면 전환을 시연한다",
  usage: "ie flow <list|create|add|link|check> [args]",
  details: [
    'create "<이름>"     빈 흐름 생성',
    "add <flow>         --screen <page-slug>   화면 편입(그 시점 버전으로 박제)",
    "link <flow>        --from <page:node> --to <page> [--action <prop>] [--value <arg>]",
    "check <flow>       사라진 노드·닿지 않는 화면을 미리 잡는다",
  ],
  async run(ctx) {
    switch (ctx.args.positionals[0]) {
      case "list":
        return runList(ctx);
      case "create":
        return runCreate(ctx);
      case "add":
        return runAdd(ctx);
      case "link":
        return runLink(ctx);
      case "check":
        return runCheck(ctx);
      default:
        throw new CliError(`알 수 없는 하위 명령: ${ctx.args.positionals[0] ?? "(없음)"}`, {
          exitCode: 64,
          hint: "사용 가능: list · create · add · link · check",
        });
    }
  },
});
