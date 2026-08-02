import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { readCredentials } from "../../auth/credentials.js";
import { resolveActorName } from "../../identity/store.js";
import { resolveConfig } from "../../config/resolve.js";
import { installBundle, validateBundle } from "../../registry/install.js";
import { CliError, color, emitJson, info, ok, warn } from "../ui.js";

/**
 * 마켓플레이스 컴포넌트를 이 프로젝트로 가져온다.
 *
 * 라이브러리로 설치하지 않고 **소스를 복사해 내 것으로 만든다.** 이 하네스에서 컴포넌트는
 * 에이전트가 고치는 대상이고, 갤러리에 뜨고, 히스토리가 쌓여야 한다 — node_modules 안에서는
 * 그중 아무것도 안 된다(자세한 이유는 registry/install.ts 주석).
 */
export const addCommand = defineCommand({
  name: "add",
  summary: "마켓플레이스 컴포넌트를 프로젝트로 가져온다",
  usage: "ie add <url> [--force] [--json]",
  details: [
    "<url>    컴포넌트 번들 JSON 주소. 마켓플레이스 상세 페이지가 알려 줍니다.",
    "--force  같은 이름이 이미 있어도 덮어씁니다.",
    "",
    "파일만 복사하는 게 아니라 레지스트리 엔트리까지 만듭니다 — 그래야 갤러리에 뜨고,",
    "다음에 비슷한 걸 만들 때 재사용 후보로 걸리고, 에이전트가 고칠 수 있습니다.",
  ],
  async run({ args, cwd }) {
    const url = args.positionals[0];
    if (!url) {
      throw new CliError("번들 주소가 필요합니다.", {
        exitCode: 64,
        hint: "ie add https://raw.githubusercontent.com/<owner>/<repo>/main/components/<owner>/<name>.json",
      });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new CliError(`주소를 해석할 수 없습니다: ${url}`, { exitCode: 64 });
    }
    // http/https 만 받는다 — file: 로 로컬 경로를 읽게 두면 이 명령이 임의 파일 읽기 통로가 된다.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new CliError(`http(s) 주소만 받습니다: ${parsed.protocol}`, { exitCode: 64 });
    }

    const configFile = flagString(args.flags, "config");
    const config = await resolveConfig({ cwd, ...(configFile ? { configFile } : {}) });

    let raw: unknown;
    let charged: string | null = null;
    let balance: string | null = null;
    try {
      /*
       * 로그인해 두었으면 자격증명을 실어 보낸다.
       *
       * 마켓플레이스는 토큰 경제를 걷으므로 "누가 받아 가는가"를 알아야 한다. 브라우저 세션은
       * 이 디스크의 파일을 못 읽으니, CLI 는 `ie login` 이 남긴 GitHub 토큰을 헤더로 보낸다.
       *
       * 로그인 안 했어도 **요청은 보낸다.** 게이트가 없는 주소(직접 올린 raw URL 등)도 있고,
       * 그때 "먼저 로그인하세요"로 막으면 되던 일이 안 되게 된다. 막을지는 서버가 정한다.
       */
      const credentials = readCredentials();
      const res = await fetch(parsed, {
        headers: {
          accept: "application/json",
          ...(credentials ? { authorization: `Bearer ${credentials.token}` } : {}),
        },
      });

      if (!res.ok) {
        // 서버가 사람이 읽을 문장을 담아 준다 — 그대로 전한다. 우리가 다시 쓰면 어긋난다.
        const body = (await res.json().catch(() => null)) as
          | { error?: string; hint?: string }
          | null;
        const known: Record<number, number> = { 401: 77, 402: 78, 403: 77 };
        throw new CliError(body?.error ?? `번들을 받지 못했습니다: ${res.status}`, {
          exitCode: known[res.status] ?? 69,
          hint: body?.hint ?? parsed.toString(),
        });
      }

      charged = res.headers.get("x-ie-charged");
      balance = res.headers.get("x-ie-balance");
      raw = await res.json();
    } catch (err) {
      if (err instanceof CliError) throw err;
      throw new CliError(`번들을 받지 못했습니다: ${String(err)}`, { exitCode: 69 });
    }

    validateBundle(raw);

    const result = installBundle(config, raw, {
      source: parsed.toString(),
      actor: resolveActorName(config.root),
      force: flagBool(args.flags, "force"),
    });

    if (flagBool(args.flags, "json")) {
      emitJson({
        name: result.entry.name,
        written: result.written,
        skipped: result.skipped,
        indexCount: result.indexCount,
        gallery: `http://${config.gallery.host}:${config.gallery.port}/c/${result.entry.name}`,
        ...(charged === null ? {} : { charged: Number(charged) }),
        ...(balance === null ? {} : { balance: Number(balance) }),
      });
      return;
    }

    ok(`${result.entry.name} 설치 · ${result.indexCount}개 엔트리`);
    for (const file of result.written) info(`  ${color.dim(file)}`);
    for (const file of result.skipped) {
      warn(`  ${file} 는 이미 있어 건드리지 않았습니다.`);
    }
    info("");
    info(
      `  갤러리  ${color.cyan(`http://${config.gallery.host}:${config.gallery.port}/c/${result.entry.name}`)}`,
    );
    /*
     * 토큰이 얼마나 나갔는지 말해 준다. 조용히 깎으면 나중에 "왜 줄었지"를 물을 곳이 없다.
     * 0 이면 이미 받은 적 있는 것이다 — 그 사실도 알려 줘야 재설치를 망설이지 않는다.
     */
    if (charged !== null) {
      const spent = Number(charged);
      info(
        `  ${color.dim(
          spent > 0
            ? `토큰 ${spent} 사용 · 남은 토큰 ${balance ?? "?"}`
            : `이미 받은 적이 있어 토큰을 쓰지 않았습니다 · 남은 토큰 ${balance ?? "?"}`,
        )}`,
      );
    }
    info(`  ${color.dim("이제 내 컴포넌트입니다 — 고치고 기록하는 절차가 그대로 걸립니다.")}`);
  },
});
