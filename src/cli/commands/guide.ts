import { flagBool } from "../args.js";
import { defineCommand } from "../command.js";
import { findProjectRoot } from "../project.js";
import { isSkillName, readGuide, SKILL_NAMES } from "../../skills/index.js";
import { CliError, emitJson, info } from "../ui.js";

/**
 * 스킬 정본을 출력한다.
 *
 * 설치된 스텁이 발동할 때마다 이걸 실행해 지침을 새로 읽는다. 스텁에 절차를 복사해 두지 않는
 * 이유: 복사본은 반드시 낡는다. 정본이 패키지 안에 하나만 있으면 `npm update` 가 곧 지침 갱신이다.
 */
export const guideCommand = defineCommand({
  name: "guide",
  summary: "스킬 정본 절차를 출력한다",
  usage: "ie guide <skill> [--json]",
  details: [`사용 가능한 스킬: ${SKILL_NAMES.join(", ")}`],
  run({ args, cwd }) {
    const name = args.positionals[0];
    if (!name) {
      throw new CliError("스킬 이름이 필요합니다.", {
        exitCode: 64,
        hint: `사용 가능: ${SKILL_NAMES.join(", ")}`,
      });
    }
    if (!isSkillName(name)) {
      throw new CliError(`알 수 없는 스킬: ${name}`, {
        exitCode: 64,
        hint: `사용 가능: ${SKILL_NAMES.join(", ")}`,
      });
    }

    const { root } = findProjectRoot(cwd);
    const guide = readGuide(name, root);
    if (!guide) {
      throw new CliError(`${name} 의 GUIDE 를 찾지 못했습니다.`, {
        exitCode: 70,
        hint: "패키지 설치가 손상된 것 같습니다. `npm install instant-elements` 를 다시 실행해 보세요.",
      });
    }

    if (flagBool(args.flags, "json")) {
      emitJson({ skill: name, path: guide.path, body: guide.body });
      return;
    }
    info(guide.body);
  },
});
