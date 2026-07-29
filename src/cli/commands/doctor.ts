import { flagBool } from "../args.js";
import { defineCommand } from "../command.js";
import { findProjectRoot, readGitInfo, satisfiesMinimum } from "../project.js";
import { color, emitJson, info, ok, symbols, warn } from "../ui.js";
import { packageVersion } from "../../pkg.js";

const MIN_NODE = "20.11.0";

type CheckLevel = "ok" | "warn" | "fail";

interface Check {
  name: string;
  level: CheckLevel;
  detail: string;
  hint?: string;
}

/**
 * 환경 점검 — 설정 로더가 붙기 전에도 "이 프로젝트에서 하네스가 돌 수 있는가"를 답한다.
 * 설정·레지스트리 점검은 로더가 들어오는 대로 이 목록에 더해진다.
 */
export const doctorCommand = defineCommand({
  name: "doctor",
  summary: "환경과 프로젝트 상태를 점검한다",
  usage: "ie doctor [--json]",
  run({ args, cwd }) {
    const checks: Check[] = [];

    const node = process.versions.node;
    checks.push(
      satisfiesMinimum(node, MIN_NODE)
        ? { name: "node", level: "ok", detail: `v${node}` }
        : {
            name: "node",
            level: "fail",
            detail: `v${node} (최소 v${MIN_NODE})`,
            hint: `Node ${MIN_NODE} 이상으로 올려주세요.`,
          },
    );

    const { root, configFile } = findProjectRoot(cwd);
    checks.push({ name: "project root", level: "ok", detail: root });
    checks.push(
      configFile
        ? { name: "config", level: "ok", detail: configFile }
        : {
            name: "config",
            level: "warn",
            detail: "instant.config.* 없음 — 기본값으로 동작",
            hint: "`ie init` 으로 설정과 디렉토리를 스캐폴드할 수 있습니다.",
          },
    );

    const git = readGitInfo(root);
    if (!git.installed) {
      checks.push({
        name: "git",
        level: "warn",
        detail: "설치되어 있지 않음",
        hint: "히스토리의 작성자가 'unknown' 으로 기록되고 SHA 복원을 쓸 수 없습니다.",
      });
    } else if (!git.repository) {
      checks.push({
        name: "git",
        level: "warn",
        detail: "git 저장소가 아님",
        hint: "`git init` 을 하면 변경 이력과 복원 지점이 남습니다.",
      });
    } else if (!git.userName) {
      checks.push({
        name: "git",
        level: "warn",
        detail: "user.name 미설정",
        hint: "`git config user.name \"<이름>\"` — 히스토리 작성자가 여기서 옵니다.",
      });
    } else {
      checks.push({ name: "git", level: "ok", detail: `저장소 · user.name=${git.userName}` });
    }

    const failed = checks.filter((c) => c.level === "fail");
    const warned = checks.filter((c) => c.level === "warn");

    if (flagBool(args.flags, "json")) {
      emitJson({
        version: packageVersion,
        root,
        configFile,
        ok: failed.length === 0,
        checks,
      });
      process.exitCode = failed.length === 0 ? 0 : 1;
      return;
    }

    info(`${color.bold("instant-elements")} ${color.dim(`v${packageVersion}`)}`);
    info("");
    for (const check of checks) {
      const mark =
        check.level === "ok"
          ? color.green(symbols.ok)
          : check.level === "warn"
            ? color.yellow(symbols.warn)
            : color.red(symbols.fail);
      info(`  ${mark} ${check.name.padEnd(14)} ${check.detail}`);
      if (check.hint && check.level !== "ok") info(`    ${color.dim(check.hint)}`);
    }
    info("");

    if (failed.length > 0) {
      warn(`${failed.length}건 실패 · ${warned.length}건 경고`);
      process.exitCode = 1;
      return;
    }
    if (warned.length > 0) {
      warn(`${warned.length}건 경고 — 동작은 하지만 위 안내를 확인하세요.`);
      return;
    }
    ok("모두 정상.");
  },
});
