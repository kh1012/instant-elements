import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { CliError } from "../cli/ui.js";
import type { ElementCategory, ElementStatus, ResolvedConfig } from "../config/types.js";
import { appendHistory } from "./history.js";
import { writeIndex } from "./index-file.js";
import { entryExists, writeEntry } from "./entry.js";
import { assertValidName, elementPaths, pascalCase } from "./paths.js";
import { ENTRY_SCHEMA_URL, type Entry } from "./schema.js";
import {
  componentTemplate,
  demoTemplate,
  indexTemplate,
  type TemplateInput,
} from "./templates.js";

/** `cn` 헬퍼가 놓이는 자리 — elementsDir 안의 공용 유틸 디렉토리. */
export const LIB_DIR_NAME = "_lib";

export interface CreateElementInput {
  name: string;
  /** 요청 원문. 왜 만들었나의 근거라 그대로 보존한다. */
  intent: string;
  /** 카드·상세에 보여줄 담백한 한 문장. */
  summary: string;
  category?: ElementCategory;
  status?: ElementStatus;
  keywords?: string[];
  exportName?: string;
  /** git user.name. */
  createdBy: string;
  /** 덮어쓰기 허용. */
  force?: boolean;
}

export interface CreateElementResult {
  entry: Entry;
  /** 실제로 쓴 파일들(프로젝트 루트 기준 상대경로). */
  written: string[];
  indexCount: number;
}

function relPath(root: string, path: string): string {
  return relative(root, path).split("\\").join("/");
}

/**
 * 컴포넌트 3파일 + 엔트리를 만들고 인덱스를 갱신한다.
 *
 * 엔트리와 코드는 **항상 쌍**이다 — 엔트리 없는 코드는 갤러리에서 보이지 않고, 코드 없는 엔트리는
 * 렌더되지 않는다. 그래서 둘을 나눠 만들 수 있는 경로를 아예 두지 않는다.
 */
export function createElement(
  config: ResolvedConfig,
  input: CreateElementInput,
): CreateElementResult {
  const name = assertValidName(input.name);
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const paths = elementPaths(dirs, name);

  if (!input.force) {
    if (entryExists(dirs, name)) {
      throw new CliError(`이미 등록된 컴포넌트입니다: ${name}`, {
        exitCode: 65,
        hint: "덮어쓰려면 --force, 고치려면 해당 파일을 직접 수정한 뒤 `ie element log` 로 기록하세요.",
      });
    }
    if (existsSync(paths.dir)) {
      throw new CliError(`디렉토리가 이미 있습니다: ${relPath(config.root, paths.dir)}`, {
        exitCode: 65,
        hint: "엔트리 없이 코드만 있는 상태입니다. --force 로 덮어쓰거나 다른 이름을 쓰세요.",
      });
    }
  }

  const exportName = input.exportName?.trim() || pascalCase(name);
  const summary = input.summary.trim();
  const intent = input.intent.trim();

  const template: TemplateInput = {
    name,
    exportName,
    summary,
    // 컴포넌트 디렉토리(<elementsDir>/<name>/)에서 <elementsDir>/_lib/cn 으로 올라간다.
    cnImport: `../${LIB_DIR_NAME}/cn`,
  };

  mkdirSync(paths.dir, { recursive: true });
  const written: string[] = [];
  const files: [string, string][] = [
    [paths.component, componentTemplate(template)],
    [paths.demo, demoTemplate(template)],
    [paths.index, indexTemplate(template)],
  ];
  for (const [path, content] of files) {
    writeFileSync(path, content);
    written.push(relPath(config.root, path));
  }

  const entry: Entry = {
    $schema: ENTRY_SCHEMA_URL,
    name,
    type: "registry:component",
    description: summary,
    files: [{ path: relPath(config.root, paths.component), type: "registry:component" }],
    meta: {
      status: input.status ?? "draft",
      category: input.category ?? "Composite",
      intent,
      summary,
      keywords: dedupeKeywords(input.keywords ?? [], name),
      createdBy: input.createdBy,
      // 실제 시각이어야 한다 — 대화 맥락의 날짜만 쓰면 전부 자정으로 붕괴해 순서를 잃는다.
      createdAt: new Date().toISOString(),
      demo: relPath(config.root, paths.demo),
      exportName,
      usage: `<${exportName} title="${exportName}" />`,
    },
  };
  writeEntry(dirs, entry);
  written.push(relPath(config.root, paths.entry));

  appendHistory(dirs, name, {
    at: entry.meta.createdAt,
    actor: input.createdBy,
    action: "created",
    prompt: intent,
  });
  written.push(relPath(config.root, paths.history));

  const index = writeIndex({
    root: config.root,
    elementsDir: config.elementsDir,
    entriesDir: config.entriesDir,
    indexFile: config.indexFile,
  });

  return { entry, written, indexCount: index.count };
}

/** 이름 조각을 검색어에 자동으로 보태고 중복·빈값을 정리한다. */
export function dedupeKeywords(keywords: string[], name: string): string[] {
  const fromName = name.split("-").filter((p) => p.length > 1);
  const all = [...keywords, name, ...fromName].map((k) => k.trim()).filter(Boolean);
  return [...new Set(all)];
}
