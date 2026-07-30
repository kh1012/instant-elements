import { readCredentials, writeCredentials } from "../../auth/credentials.js";
import { runDeviceFlow } from "../../auth/github-device-flow.js";
import { resolveConfig } from "../../config/resolve.js";
import { flagBool } from "../args.js";
import { defineCommand } from "../command.js";
import { color, emitJson, info, ok } from "../ui.js";

export const loginCommand = defineCommand({
  name: "login",
  summary: "GitHub 계정으로 로그인해 발행 자격을 얻는다",
  usage: "ie login [--force] [--json]",
  details: [
    "GitHub Device Flow — 코드를 보여 주고 브라우저에서 입력을 기다립니다.",
    "--force  이미 로그인돼 있어도 다시 로그인합니다.",
  ],
  async run({ args, cwd }) {
    const config = await resolveConfig({ cwd });
    const existing = readCredentials();
    if (existing && !flagBool(args.flags, "force")) {
      if (flagBool(args.flags, "json")) {
        emitJson({ githubLogin: existing.githubLogin, reused: true });
        return;
      }
      ok(`이미 ${existing.githubLogin} 로 로그인돼 있습니다.`);
      info(`  ${color.dim("다시 로그인하려면 --force 를 붙이세요.")}`);
      return;
    }

    const result = await runDeviceFlow(config.publish.oauthClientId, {
      onCode({ userCode, verificationUri }) {
        info("");
        info(`  ${verificationUri} 를 열고 아래 코드를 입력하세요:`);
        info(`  ${color.bold(color.cyan(userCode))}`);
        info("");
        info(color.dim("  승인을 기다리는 중…"));
      },
    });

    writeCredentials(result);

    if (flagBool(args.flags, "json")) {
      emitJson({ githubLogin: result.githubLogin, reused: false });
      return;
    }
    ok(`${result.githubLogin} 로 로그인했습니다.`);
  },
});
