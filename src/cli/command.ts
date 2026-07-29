import type { ParsedArgs } from "./args.js";

export interface CommandContext {
  args: ParsedArgs;
  /** 명령이 실행된 디렉토리. 테스트에서 주입할 수 있게 인자로 흐른다. */
  cwd: string;
}

export interface Command {
  name: string;
  summary: string;
  usage?: string;
  /** 하위 명령이 있으면 도움말에 함께 표시한다. */
  details?: string[];
  run(ctx: CommandContext): Promise<void> | void;
}

export function defineCommand(command: Command): Command {
  return command;
}
