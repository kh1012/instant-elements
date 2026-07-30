import { readCredentials } from "../../auth/credentials.js";
import { resolveConfig } from "../../config/resolve.js";
import { readEntry, validateEntry } from "../../registry/entry.js";
import { buildPublishBundle } from "../../registry/publish.js";
import { validateRegistry } from "../../validate/index.js";
import { flagBool } from "../args.js";
import { defineCommand } from "../command.js";
import { CliError, color, emitJson, info, ok } from "../ui.js";

export const publishCommand = defineCommand({
  name: "publish",
  summary: "컴포넌트를 마켓플레이스에 발행한다",
  usage: "ie publish <name> [--json]",
  details: [
    "<name>  발행할 컴포넌트 이름. `ie login` 으로 먼저 로그인해야 합니다.",
    "발행 전 계약 검사와 `ie element validate` 하드룰 게이트를 통과해야 합니다.",
    "이름공간은 GitHub 로그인 기준 `<githubLogin>/<name>` 으로 붙습니다.",
  ],
  async run({ args, cwd }) {
    const name = args.positionals[0];
    if (!name) {
      throw new CliError("컴포넌트 이름이 필요합니다.", { exitCode: 64, hint: "ie publish <name>" });
    }

    const config = await resolveConfig({ cwd });

    const credentials = readCredentials();
    if (!credentials) {
      throw new CliError("로그인이 필요합니다.", { exitCode: 77, hint: "먼저 `ie login` 을 실행하세요." });
    }

    const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
    const entry = readEntry(dirs, name);

    const contractProblems = validateEntry(entry);
    if (contractProblems.length > 0) {
      throw new CliError(`${name} 의 엔트리 계약이 완전하지 않습니다.`, {
        exitCode: 65,
        hint: contractProblems.join(" · "),
      });
    }

    const gate = validateRegistry(config, { only: name });
    const blocks = gate.findings.filter((f) => f.level === "block");
    if (blocks.length > 0) {
      throw new CliError(`${name} 이 검증 게이트를 통과하지 못했습니다.`, {
        exitCode: 65,
        hint: `ie element validate ${name} 로 자세히 확인하세요.`,
      });
    }

    const bundle = buildPublishBundle(config, entry);
    const owner = credentials.githubLogin;
    const publishName = `${owner}/${name}`;

    const response = await fetch(`${config.publish.url}/api/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.token}`,
      },
      body: JSON.stringify({ owner, bundle }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new CliError(`발행에 실패했습니다: ${response.status}`, {
        exitCode: 69,
        ...(body ? { hint: body } : {}),
      });
    }

    const result = (await response.json()) as { url?: string };

    if (flagBool(args.flags, "json")) {
      emitJson({ name: publishName, url: result.url });
      return;
    }
    ok(`${publishName} 발행됨`);
    if (result.url) info(`  ${color.cyan(result.url)}`);
  },
});
