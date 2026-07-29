import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { findProjectRoot } from "../project.js";
import { AGENT_DIRS, SKILL_NAMES, shippedSkillDir } from "../../skills/index.js";
import { CliError, color, emitJson, info, ok } from "../ui.js";

/**
 * 스킬 스텁을 에이전트 디렉토리에 설치한다.
 *
 * **스텁(SKILL.md)만 복사하고 GUIDE 는 복사하지 않는다.** GUIDE 를 프로젝트에 흩뿌리면 정본이
 * 여러 벌 생겨 반드시 낡는다. 스텁은 발동할 때마다 `ie guide` 로 패키지 안의 정본을 새로 읽으므로,
 * 패키지를 업데이트하면 지침도 함께 갱신된다 — 스킬 재설치가 필요 없다.
 */
export const skillsCommand = defineCommand({
  name: "skills",
  summary: "코딩 에이전트에 스킬을 설치한다",
  usage: "ie skills install [--agent claude|codex|all] [--force]",
  details: [
    `설치되는 스킬: ${SKILL_NAMES.join(", ")}`,
    "스텁만 복사합니다 — 절차 정본은 패키지 안에 남아 `npm update` 로 갱신됩니다.",
    `대상: ${Object.entries(AGENT_DIRS)
      .map(([agent, dir]) => `${agent}=${dir}`)
      .join(" · ")}`,
  ],
  run({ args, cwd }) {
    const sub = args.positionals[0] ?? "install";
    if (sub !== "install") {
      throw new CliError(`알 수 없는 하위 명령: ${sub}`, { exitCode: 64, hint: "사용 가능: install" });
    }

    const { root } = findProjectRoot(cwd);
    const agentFlag = flagString(args.flags, "agent", "all") as string;
    const agents =
      agentFlag === "all" ? Object.keys(AGENT_DIRS) : agentFlag.split(",").map((a) => a.trim());

    for (const agent of agents) {
      if (!AGENT_DIRS[agent]) {
        throw new CliError(`알 수 없는 에이전트: ${agent}`, {
          exitCode: 64,
          hint: `사용 가능: ${Object.keys(AGENT_DIRS).join(", ")}, all`,
        });
      }
    }

    const force = flagBool(args.flags, "force");
    const installed: string[] = [];
    const skipped: string[] = [];

    for (const agent of agents) {
      const base = AGENT_DIRS[agent];
      if (!base) continue;
      for (const skill of SKILL_NAMES) {
        const source = join(shippedSkillDir(skill), "SKILL.md");
        if (!existsSync(source)) {
          throw new CliError(`스킬 스텁을 찾지 못했습니다: ${skill}`, {
            exitCode: 70,
            hint: "패키지 설치가 손상된 것 같습니다.",
          });
        }
        const targetDir = join(root, base, skill);
        const target = join(targetDir, "SKILL.md");
        const shown = relative(root, target).split("\\").join("/");

        if (existsSync(target) && !force) {
          skipped.push(shown);
          continue;
        }
        mkdirSync(targetDir, { recursive: true });
        copyFileSync(source, target);
        installed.push(shown);
      }
    }

    if (flagBool(args.flags, "json")) {
      emitJson({ root, agents, installed, skipped });
      return;
    }

    ok(`${installed.length}개 설치${skipped.length > 0 ? ` · ${skipped.length}개 건너뜀` : ""}`);
    for (const path of installed) info(`  ${color.green("+")} ${path}`);
    for (const path of skipped) info(`  ${color.dim(`· ${path} (이미 있음 — --force 로 덮어쓰기)`)}`);

    info("");
    info(`  ${color.dim("새 세션에서")} ${color.cyan("/element-create")} ${color.dim("로 쓰거나,")}`);
    info(`  ${color.dim('"○○ 컴포넌트 만들어줘" 라고 말하면 자동으로 발동합니다.')}`);
  },
});
