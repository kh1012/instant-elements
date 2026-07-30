import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CliError } from "../cli/ui.js";
import type { ResolvedConfig } from "../config/types.js";
import { elementPaths, type RegistryDirs } from "./paths.js";
import { ENTRY_SCHEMA_URL, type Entry, type EntryFile, type EntryMeta } from "./schema.js";

/**
 * 발행 번들.
 *
 * 로컬 `entry.files` 는 컴포넌트 본체 하나뿐이고 내용도 안 담는다(경로만). 발행은 그걸로 부족하다 —
 * 데모·배럴·공유 `cn` 헬퍼까지 모아 실제 소스를 인라인해야 이 프로젝트 밖(마켓플레이스, 다른 프로젝트의
 * `ie add`)에서 재구성될 수 있다. 그래서 로컬 저장 스키마(`schema.ts`)는 건드리지 않고, 발행 시점
 * 전용 변환으로 분리한다.
 */
export interface PublishFile extends EntryFile {
  content: string;
}

export interface PublishBundle {
  $schema: string;
  name: string;
  type: "registry:component";
  description: string;
  files: PublishFile[];
  meta: EntryMeta;
}

function relFromRoot(root: string, absPath: string): string {
  return relative(root, absPath).split("\\").join("/");
}

function readFileOrThrow(absPath: string, label: string): string {
  if (!existsSync(absPath)) {
    throw new CliError(`발행할 파일을 찾지 못했습니다: ${label}`, {
      exitCode: 66,
      hint: absPath,
    });
  }
  return readFileSync(absPath, "utf8");
}

/**
 * 컴포넌트가 공유하는 `cn` 헬퍼의 절대경로. `templates.ts` 의 `cnImport`(`../_lib/cn`)가
 * 만드는 상대경로와 짝이어야 발행된 컴포넌트를 설치했을 때 import 가 그대로 풀린다.
 */
function sharedLibCnPath(config: ResolvedConfig): string {
  return join(config.elementsDir, "_lib", "cn.ts");
}

/** 로컬 엔트리를 마켓플레이스에 올릴 수 있는 자기완결적 번들로 바꾼다. */
export function buildPublishBundle(config: ResolvedConfig, entry: Entry): PublishBundle {
  const dirs: RegistryDirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const paths = elementPaths(dirs, entry.name);

  const componentRel = entry.files[0]?.path ?? relFromRoot(config.root, paths.component);
  const demoRel = entry.meta.demo ?? relFromRoot(config.root, paths.demo);
  const indexRel = relFromRoot(config.root, paths.index);
  const cnAbs = sharedLibCnPath(config);
  const cnRel = relFromRoot(config.root, cnAbs);

  const files: PublishFile[] = [
    {
      path: componentRel,
      type: "registry:component",
      content: readFileOrThrow(join(config.root, componentRel), `${entry.name} 본체`),
    },
    {
      path: demoRel,
      type: "registry:file",
      content: readFileOrThrow(join(config.root, demoRel), `${entry.name} 데모`),
    },
    {
      path: indexRel,
      type: "registry:file",
      content: readFileOrThrow(paths.index, `${entry.name} 배럴`),
    },
    {
      path: cnRel,
      type: "registry:file",
      content: readFileOrThrow(cnAbs, "공유 cn 헬퍼"),
    },
  ];

  return {
    $schema: ENTRY_SCHEMA_URL,
    name: entry.name,
    type: "registry:component",
    description: entry.description,
    files,
    meta: entry.meta,
  };
}
