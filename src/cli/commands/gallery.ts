import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { resolveConfig } from "../../config/resolve.js";
import { describeListenError, startGallery } from "../../gallery/server.js";
import { listEntryNames } from "../../registry/entry.js";
import { color, info, ok } from "../ui.js";

/**
 * 갤러리를 포그라운드로 띄운다.
 *
 * 백그라운드로 보내지 않는다 — 개발자가 Ctrl+C 로 끄는 것이 명확하고, 에이전트가 몰래 서버를
 * 띄워 두면 어느 프로젝트의 갤러리가 그 포트를 쥐고 있는지 아무도 모르게 된다.
 */
export const galleryCommand = defineCommand({
  name: "gallery",
  summary: "컴포넌트 갤러리를 띄운다",
  usage: "ie gallery [--port 9221] [--host 127.0.0.1] [--open]",
  async run({ args, cwd }) {
    const configFile = flagString(args.flags, "config");
    const config = await resolveConfig({ cwd, ...(configFile ? { configFile } : {}) });

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
