import { commands } from "./commands/index.js";
import { color, info } from "./ui.js";
import { packageVersion } from "../pkg.js";

export function printHelp(): void {
  info(`${color.bold("instant-elements")} ${color.dim(`v${packageVersion}`)}`);
  info("코딩 에이전트 기반 UI 하네스 — 설명하면 만들어지고, 갤러리에서 보이고, 기록된다.");
  info("");
  info(color.bold("사용법"));
  info("  ie <command> [options]");
  info("");
  info(color.bold("명령"));
  const width = Math.max(...commands.map((c) => c.name.length));
  for (const command of commands) {
    info(`  ${command.name.padEnd(width + 2)}${command.summary}`);
  }
  info("");
  info(color.bold("전역 옵션"));
  info("  -h, --help       도움말");
  info("  -v, --version    버전");
  info("");
  info(color.dim("문서: https://github.com/kh1012/instant-elements#readme"));
}

export function printCommandHelp(name: string): void {
  const command = commands.find((c) => c.name === name);
  if (!command) return printHelp();
  info(`${color.bold(command.name)} — ${command.summary}`);
  if (command.usage) {
    info("");
    info(color.bold("사용법"));
    info(`  ${command.usage}`);
  }
  if (command.details?.length) {
    info("");
    for (const line of command.details) info(`  ${line}`);
  }
}
