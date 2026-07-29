import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { findProjectRoot } from "../project.js";
import { DEFAULTS } from "../../config/defaults.js";
import { resolveConfig } from "../../config/resolve.js";
import { writeIndex } from "../../registry/index-file.js";
import { LIB_DIR_NAME } from "../../registry/create.js";
import { cnTemplate, configTemplate } from "../../registry/templates.js";
import { color, emitJson, info, ok, warn } from "../ui.js";

/**
 * 프로젝트를 하네스가 돌 수 있는 상태로 만든다.
 *
 * 이미 있는 파일은 덮어쓰지 않는다(`--force` 로만). init 은 여러 번 실행될 수 있고,
 * 두 번째 실행이 사람이 고쳐 둔 설정을 날리면 안 된다.
 */
export const initCommand = defineCommand({
  name: "init",
  summary: "설정·디렉토리·유틸을 스캐폴드한다",
  usage: "ie init [--elements-dir src/elements] [--import-alias @/elements] [--force] [--json]",
  details: [
    "이미 있는 파일은 건너뜁니다 — 덮어쓰려면 --force.",
    "생성물: instant.config.ts · <elementsDir>/_lib/cn.ts · 레지스트리·페이지·흐름 디렉토리",
  ],
  async run({ args, cwd }) {
    const force = flagBool(args.flags, "force");
    const { root } = findProjectRoot(cwd);

    const elementsDir = flagString(args.flags, "elements-dir", DEFAULTS.elementsDir) as string;
    const importAlias = flagString(args.flags, "import-alias", DEFAULTS.importAlias) as string;

    const created: string[] = [];
    const skipped: string[] = [];
    const rel = (p: string) => relative(root, p).split("\\").join("/");

    const write = (path: string, content: string): void => {
      if (existsSync(path) && !force) {
        skipped.push(rel(path));
        return;
      }
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, content);
      created.push(rel(path));
    };

    // 1) 설정 파일 — 이후 모든 경로가 여기서 나온다.
    write(
      join(root, "instant.config.ts"),
      configTemplate({
        elementsDir,
        importAlias,
        registryDir: DEFAULTS.registryDir,
        pagesDir: DEFAULTS.pagesDir,
        flowsDir: DEFAULTS.flowsDir,
      }),
    );

    // 방금 쓴 설정을 그대로 다시 읽어 해석한다 — init 이 만드는 경로와 이후 명령이 보는 경로가
    // 어긋날 여지를 없앤다(설정을 두 번 해석하지 않고 한 소스만 신뢰).
    const config = await resolveConfig({ cwd: root });

    // 2) 데이터 디렉토리.
    for (const dir of [config.entriesDir, config.pagesDir, config.flowsDir, config.elementsDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        created.push(`${rel(dir)}/`);
      }
    }

    // 3) cn 헬퍼 — 라이브러리에서 import 하지 않고 프로젝트에 복사해 둔다.
    write(join(config.elementsDir, LIB_DIR_NAME, "cn.ts"), cnTemplate());

    // 4) 빈 인덱스 — 갤러리가 첫 기동부터 읽을 파일이 있게.
    if (!existsSync(config.indexFile) || force) {
      writeIndex({
        root: config.root,
        elementsDir: config.elementsDir,
        entriesDir: config.entriesDir,
        indexFile: config.indexFile,
      });
      created.push(rel(config.indexFile));
    } else {
      skipped.push(rel(config.indexFile));
    }

    const cssHint = [
      '@import "tailwindcss";',
      '@import "instant-elements/theme.css";',
      `@source "./${rel(config.elementsDir)}";`,
    ];

    if (flagBool(args.flags, "json")) {
      emitJson({ root, created, skipped, config, cssSnippet: cssHint.join("\n") });
      return;
    }

    ok(`${created.length}개 생성${skipped.length > 0 ? ` · ${skipped.length}개 건너뜀` : ""}`);
    for (const path of created) info(`  ${color.green("+")} ${path}`);
    for (const path of skipped) info(`  ${color.dim(`· ${path} (이미 있음)`)}`);

    info("");
    info(color.bold("  다음 단계"));
    info("");
    info(`  ${color.dim("1.")} Tailwind 진입 CSS 에 토큰을 연결하세요:`);
    for (const line of cssHint) info(`       ${color.cyan(line)}`);
    info("");
    info(`  ${color.dim("2.")} 앱 루트에 스코프 속성을 붙이세요:`);
    info(`       ${color.cyan('<html data-instant data-theme="light">')}`);
    info("");
    info(`  ${color.dim("3.")} ${color.cyan(`"${importAlias}/*"`)} 별칭을 tsconfig paths 에 추가하세요.`);
    info("");
    info(`  ${color.dim("4.")} 코딩 에이전트에 스킬을 설치하세요:`);
    info(`       ${color.cyan("ie skills install")}`);
    info("");
    info(`  ${color.dim("5.")} 이제 에이전트에게 말로 시키면 됩니다:`);
    info(`       ${color.cyan('"대시보드에 쓸 지표 카드 만들어줘"')}`);
    info(`       ${color.dim("직접 만들려면  ie element new stat-card --intent \"…\" --summary \"…\"")}`);

    if (skipped.includes("instant.config.ts")) {
      info("");
      warn("instant.config.ts 는 이미 있어 건드리지 않았습니다.");
    }
  },
});
