import { existsSync } from "node:fs";
import { relative } from "node:path";
import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { resolveConfig } from "../../config/resolve.js";
import { color, emitJson, info, warn } from "../ui.js";

/** 절대경로를 루트 기준 상대경로로 — 사람이 읽는 출력에서만 쓴다(--json 은 절대경로 그대로). */
function rel(root: string, path: string): string {
  const r = relative(root, path);
  return r === "" ? "." : r.startsWith("..") ? path : r;
}

interface Row {
  label: string;
  display: string;
  /** 있으면 존재 여부를 확인해 "(아직 없음)"을 붙인다. */
  path?: string;
}

/**
 * 해석된 설정을 출력한다.
 *
 * 이 명령이 스킬 GUIDE 의 경로 하드코딩을 대체한다 — GUIDE 는 "레지스트리는 여기 있다"고 적는 대신
 * `ie config --json` 의 `entriesDir` 를 읽으라고 적는다. 소비 프로젝트마다 경로가 달라도 같은 지침이 돈다.
 */
export const configCommand = defineCommand({
  name: "config",
  summary: "해석된 설정과 경로를 출력한다",
  usage: "ie config [--json] [--config <file>]",
  details: [
    "--json          기계 판독용. 모든 경로가 절대경로다(에이전트·스크립트는 이걸 쓴다).",
    "--config <file> 설정 파일을 직접 지정한다(탐색 건너뜀).",
  ],
  async run({ args, cwd }) {
    const configFile = flagString(args.flags, "config");
    const config = await resolveConfig({ cwd, ...(configFile ? { configFile } : {}) });

    if (flagBool(args.flags, "json")) {
      emitJson(config);
      return;
    }

    const dir = (label: string, abs: string): Row => ({
      label,
      display: rel(config.root, abs),
      path: abs,
    });

    const rows: Row[] = [
      { label: "root", display: config.root },
      { label: "config", display: config.configFile ?? color.dim("(없음 — 기본값)") },
      dir("elementsDir", config.elementsDir),
      { label: "importAlias", display: config.importAlias },
      dir("registryDir", config.registryDir),
      dir("entriesDir", config.entriesDir),
      dir("pagesDir", config.pagesDir),
      dir("flowsDir", config.flowsDir),
      { label: "tokens.css", display: config.tokens.css, path: config.tokens.css },
      { label: "gallery", display: `http://${config.gallery.host}:${config.gallery.port}` },
      { label: "gallery.title", display: config.gallery.title },
      {
        label: "gallery.agent",
        display: config.gallery.agent
          ? `on ${color.dim("(브라우저에서 에이전트 실행 가능)")}`
          : `off ${color.dim("(ie gallery --agent 로 켭니다)")}`,
      },
      {
        label: "validate",
        display: Object.entries(config.validate)
          .map(([k, v]) => `${k}=${v ? "on" : "off"}`)
          .join(" · "),
      },
      { label: "publish", display: config.publish.url },
    ];

    const width = Math.max(...rows.map((r) => r.label.length));
    info("");
    for (const row of rows) {
      const missing = row.path !== undefined && !existsSync(row.path);
      const suffix = missing ? ` ${color.dim("(아직 없음)")}` : "";
      info(`  ${color.dim(row.label.padEnd(width))}  ${row.display}${suffix}`);
    }
    info("");

    if (!config.configFile) {
      warn("설정 파일이 없어 기본값으로 동작합니다 — `ie init` 으로 만들 수 있습니다.");
    }
  },
});
