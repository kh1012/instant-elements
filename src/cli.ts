#!/usr/bin/env node
import { flagBool } from "./cli/args.js";
import { parseArgs } from "./cli/args.js";
import { commandByName, commands } from "./cli/commands/index.js";
import { printCommandHelp, printHelp } from "./cli/help.js";
import { CliError, color, error, info } from "./cli/ui.js";
import { packageVersion } from "./pkg.js";

async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  if (flagBool(args.flags, "version") || flagBool(args.flags, "v")) {
    info(packageVersion);
    return;
  }

  if (!args.command) {
    printHelp();
    return;
  }

  if (args.command === "help") {
    const target = args.positionals[0];
    if (target) printCommandHelp(target);
    else printHelp();
    return;
  }

  const command = commandByName.get(args.command);
  if (!command) {
    throw new CliError(`알 수 없는 명령: ${args.command}`, {
      exitCode: 64,
      hint: `사용 가능: ${commands.map((c) => c.name).join(", ")} — \`ie help\` 로 전체 도움말.`,
    });
  }

  if (flagBool(args.flags, "help") || flagBool(args.flags, "h")) {
    printCommandHelp(command.name);
    return;
  }

  await command.run({ args, cwd: process.cwd() });
}

main(process.argv.slice(2)).catch((err: unknown) => {
  if (err instanceof CliError) {
    error(err.message);
    if (err.hint) info(`  ${color.dim(err.hint)}`);
    process.exit(err.exitCode);
  }
  error(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack && process.env["IE_DEBUG"]) info(color.dim(err.stack));
  process.exit(1);
});
