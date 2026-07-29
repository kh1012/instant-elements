import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { resolveConfig } from "../../config/resolve.js";
import type { ResolvedConfig } from "../../config/types.js";
import { describeListenError, startGallery } from "../../gallery/server.js";
import { checkGallery } from "../../gallery/status.js";
import { listEntryNames } from "../../registry/entry.js";
import { color, emitJson, error, info, ok, warn } from "../ui.js";

/**
 * 갤러리를 포그라운드로 띄운다.
 *
 * 백그라운드로 보내지 않는다 — 개발자가 Ctrl+C 로 끄는 것이 명확하고, 에이전트가 몰래 서버를
 * 띄워 두면 어느 프로젝트의 갤러리가 그 포트를 쥐고 있는지 아무도 모르게 된다.
 */
/**
 * 갤러리 상태 확인 — 딥링크를 "확인됨" 이라고 말해도 되는지의 유일한 근거.
 *
 * 신원(app·root)을 먼저 보고, 그다음에 엔트리를 본다. 순서가 반대면 다른 프로젝트의
 * 갤러리가 같은 이름을 갖고 있을 때 위양성이 난다.
 */
async function runStatus(
  args: { flags: Record<string, unknown>; positionals: string[] },
  config: ResolvedConfig,
): Promise<void> {
  const entry = flagString(args.flags as never, "entry") ?? args.positionals[1];
  const status = await checkGallery(config, { ...(entry ? { entry } : {}) });

  if (flagBool(args.flags as never, "json")) {
    emitJson(status);
    process.exitCode = status.state === "ours" && status.entry?.exists !== false ? 0 : 1;
    return;
  }

  if (status.state === "down") {
    warn(`갤러리가 실행 중이 아닙니다 — ${status.url}`);
    info(`  ${color.dim("`ie gallery` 로 띄운 뒤 다시 확인하세요. 링크는 미검증입니다.")}`);
    process.exitCode = 1;
    return;
  }

  if (status.state === "foreign") {
    error(`${status.url} 을 다른 갤러리가 쓰고 있습니다.`);
    info(`  ${color.dim(`app=${status.app}`)}`);
    if (status.root) info(`  ${color.dim(`프로젝트=${status.root}`)}`);
    info(`  ${color.dim(`내 프로젝트=${config.root}`)}`);
    info("");
    info(`  ${color.dim("이 포트의 응답은 내 프로젝트와 무관합니다 — 다른 포트로 띄우세요: `ie gallery --port 9222`")}`);
    process.exitCode = 1;
    return;
  }

  if (!status.entry) {
    ok(`내 프로젝트의 갤러리가 실행 중입니다 — ${status.url}`);
    return;
  }

  if (status.entry.exists) {
    ok(`확인됨 — ${status.url}/c/${status.entry.name}`);
    return;
  }
  warn(`갤러리는 내 프로젝트를 보고 있지만 ${status.entry.name} 이 없습니다.`);
  info(`  ${color.dim("`ie index` 를 실행했는지, 이름이 맞는지 확인하세요.")}`);
  process.exitCode = 1;
}

export const galleryCommand = defineCommand({
  name: "gallery",
  summary: "컴포넌트 갤러리를 띄운다",
  usage: "ie gallery [--port 9221] [--host 127.0.0.1] [--open]  ·  ie gallery status [name]",
  details: [
    "status [name]  지금 뜬 갤러리가 **내 프로젝트의** 갤러리인지 먼저 확인하고,",
    "               이름을 주면 그 딥링크가 실제로 열리는지까지 확인합니다.",
    "               딥링크를 '확인됨' 이라고 말해도 되는 유일한 근거입니다.",
  ],
  async run({ args, cwd }) {
    const configFile = flagString(args.flags, "config");
    const config = await resolveConfig({ cwd, ...(configFile ? { configFile } : {}) });

    if (args.positionals[0] === "status") {
      return runStatus(args, config);
    }

    const portFlag = flagString(args.flags, "port");
    const port = portFlag ? Number.parseInt(portFlag, 10) : config.gallery.port;
    const host = flagString(args.flags, "host", config.gallery.host) as string;

    try {
      await startGallery({
        config,
        port,
        host,
        open: flagBool(args.flags, "open", config.gallery.open),
      });
    } catch (error) {
      throw describeListenError(error, port);
    }

    const count = listEntryNames({
      elementsDir: config.elementsDir,
      entriesDir: config.entriesDir,
    }).length;
    const base = `http://${host}:${port}`;

    ok(`갤러리 실행 중 · ${count}개 컴포넌트`);
    info("");
    info(`  ${color.cyan(base)}`);
    info(`  ${color.dim(`프로젝트  ${config.root}`)}`);
    info("");
    info(color.dim("  Ctrl+C 로 종료합니다."));
  },
});
