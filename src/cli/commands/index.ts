import type { Command } from "../command.js";
import { addCommand } from "./add.js";
import { configCommand } from "./config.js";
import { doctorCommand } from "./doctor.js";
import { elementCommand } from "./element.js";
import { flowCommand } from "./flow.js";
import { galleryCommand } from "./gallery.js";
import { guideCommand } from "./guide.js";
import { indexCommand } from "./index-cmd.js";
import { initCommand } from "./init.js";
import { loginCommand } from "./login.js";
import { pageCommand } from "./page.js";
import { publishCommand } from "./publish.js";
import { skillsCommand } from "./skills.js";

/** 등록 순서가 곧 도움말 표시 순서다 — 처음 쓰는 사람이 밟는 순서로 둔다. */
export const commands: Command[] = [
  initCommand,
  skillsCommand,
  elementCommand,
  addCommand,
  loginCommand,
  publishCommand,
  pageCommand,
  flowCommand,
  galleryCommand,
  indexCommand,
  guideCommand,
  configCommand,
  doctorCommand,
];

export const commandByName = new Map(commands.map((c) => [c.name, c]));
