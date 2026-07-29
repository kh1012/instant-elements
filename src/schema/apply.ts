import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "../cli/ui.js";
import type { ResolvedConfig } from "../config/types.js";
import { readEntry, writeEntry } from "../registry/entry.js";
import type { PropSchema } from "../registry/schema.js";
import { extractProps, propsEqual, toEntryProps, type ExtractedProp } from "./extract.js";

export interface SchemaResult {
  name: string;
  /** 컴포넌트 소스에서 뽑은 스키마. */
  extracted: PropSchema[];
  /** 엔트리에 이미 저장돼 있던 스키마. */
  current: PropSchema[];
  /** 둘이 같은가. `--check` 가 이 값으로 종료코드를 정한다. */
  inSync: boolean;
  /** Props 타입 자체를 못 찾았는가(빈 Props 와 구분). */
  found: boolean;
  raw: ExtractedProp[];
}

/**
 * 컴포넌트 소스에서 props 스키마를 뽑아 엔트리와 비교한다.
 *
 * 이 스키마는 문서용이 아니다 — **페이지 조립이 이걸 읽어 실 컴포넌트에 값을 넘긴다.**
 * 코드와 어긋나면 페이지가 없는 prop 을 넘기거나 있는 prop 을 못 채운다. 그래서 `--check` 로
 * 드리프트를 잡을 수 있게 두 형태를 항상 함께 돌려준다.
 */
export function computeSchema(config: ResolvedConfig, name: string): SchemaResult {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const entry = readEntry(dirs, name);

  const relative = entry.files[0]?.path;
  if (!relative) {
    throw new CliError(`엔트리에 코드 경로가 없습니다: ${name}`, { exitCode: 65 });
  }
  const sourcePath = join(config.root, relative);

  let source: string;
  try {
    source = readFileSync(sourcePath, "utf8");
  } catch (err) {
    throw new CliError(`컴포넌트 소스를 읽지 못했습니다: ${relative}`, {
      exitCode: 66,
      hint: err instanceof Error ? err.message : String(err),
    });
  }

  const { props, found } = extractProps(source, entry.meta.exportName);
  const extracted = toEntryProps(props);
  const current = entry.meta.props ?? [];

  return { name, extracted, current, inSync: propsEqual(current, extracted), found, raw: props };
}

/** 추출한 스키마를 엔트리에 써넣는다. */
export function applySchema(config: ResolvedConfig, result: SchemaResult): void {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const entry = readEntry(dirs, result.name);
  entry.meta.props = result.extracted;
  writeEntry(dirs, entry);
}
