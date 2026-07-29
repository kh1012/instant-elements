import type { Command } from "../command.js";
import { configCommand } from "./config.js";
import { doctorCommand } from "./doctor.js";

/** 등록 순서가 곧 도움말 표시 순서다. */
export const commands: Command[] = [doctorCommand, configCommand];

export const commandByName = new Map(commands.map((c) => [c.name, c]));
