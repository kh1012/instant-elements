import { relative } from "node:path";
import { flagBool, flagString } from "../args.js";
import { defineCommand } from "../command.js";
import { resolveConfig } from "../../config/resolve.js";
import { writeIndex } from "../../registry/index.js";
import { color, emitJson, info, ok } from "../ui.js";

/**
 * `index.json` 재생성.
 *
 * 엔트리를 추가·수정한 뒤 항상 실행한다. 출력이 결정적이라 여러 번 돌려도 diff 가 생기지 않는다.
 */
export const indexCommand = defineCommand({
  name: "index",
  summary: "레지스트리 index.json 을 재생성한다",
  usage: "ie index [--json] [--config <file>]",
  async run({ args, cwd }) {
    const configFile = flagString(args.flags, "config");
    const config = await resolveConfig({ cwd, ...(configFile ? { configFile } : {}) });

    const index = writeIndex({
      root: config.root,
      elementsDir: config.elementsDir,
      entriesDir: config.entriesDir,
      indexFile: config.indexFile,
    });

    if (flagBool(args.flags, "json")) {
      emitJson({ file: config.indexFile, count: index.count, components: index.components });
      return;
    }

    const byStatus = index.components.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(byStatus)
      .map(([k, v]) => `${k}:${v}`)
      .join(" · ");
    const renderable = index.components.filter((c) => c.hasDemo).length;

    ok(
      `${index.count}개 엔트리 → ${relative(config.root, config.indexFile)}` +
        (summary ? ` ${color.dim(`(${summary})`)}` : ""),
    );
    if (index.count > 0 && renderable < index.count) {
      info(
        `  ${color.dim(`${index.count - renderable}개는 데모가 없어 페이지 노드로 쓸 수 없습니다.`)}`,
      );
    }
  },
});
