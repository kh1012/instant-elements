import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { CliError } from "../cli/ui.js";
import type { ResolvedConfig } from "../config/types.js";
import { LIB_DIR_NAME } from "./create.js";
import { entryExists, writeEntry } from "./entry.js";
import { appendHistory } from "./history.js";
import { writeIndex } from "./index-file.js";
import { assertValidName, elementPaths } from "./paths.js";
import type { PublishBundle } from "./publish.js";
import { ENTRY_SCHEMA_URL, isCategory, isStatus, type Entry } from "./schema.js";

/**
 * 마켓플레이스에서 받은 번들을 이 프로젝트에 설치한다 — `buildPublishBundle` 의 역방향.
 *
 * ## 왜 라이브러리로 안 쓰고 소스를 복사해 넣는가
 * 이 하네스의 전제는 "컴포넌트는 **내 코드**이고 에이전트가 그걸 고친다"이다. node_modules 에
 * 있으면 수정·분할 프롬프트가 무의미해지고, 갤러리(내 레지스트리를 읽는다)에도 안 뜨고,
 * `ie element log/status/restore` 도 안 걸린다. 그래서 shadcn 처럼 소스를 가져와 **내 것으로** 만든다.
 *
 * ## 레지스트리 엔트리를 반드시 함께 만드는 이유
 * 파일만 복사하면 "설치했는데 갤러리에 없는" 상태가 된다. 그러면 다음에 비슷한 걸 만들 때
 * 재사용 후보로도 안 걸려, 이 도구의 존재 이유인 중복 방지가 그 컴포넌트에만 구멍이 난다.
 */

/** 번들 파일이 프로젝트에서 맡는 자리. 이름으로 경로를 **직접 계산**하려고 역할로 분류한다. */
type Slot = "component" | "demo" | "index" | "cn";

function classify(path: string, name: string): Slot | null {
  const tail = path.split("/").pop() ?? "";
  if (path.endsWith(`${LIB_DIR_NAME}/cn.ts`)) return "cn";
  if (tail === `${name}.demo.tsx`) return "demo";
  if (tail === "index.ts") return "index";
  if (tail === `${name}.tsx`) return "component";
  return null;
}

export interface InstallResult {
  entry: Entry;
  /** 실제로 쓴 파일(프로젝트 루트 기준 상대경로). */
  written: string[];
  /** 이미 있어서 건드리지 않은 파일. */
  skipped: string[];
  indexCount: number;
}

export interface InstallOptions {
  /** 어디서 받았는지 — 히스토리에 남겨 출처를 추적할 수 있게 한다. */
  source: string;
  /** 설치를 실행한 사람(git user.name). */
  actor: string;
  force?: boolean;
}

/** 번들이 최소 계약을 지키는지. 네트워크 너머에서 온 데이터라 쓰기 전에 반드시 본다. */
export function validateBundle(value: unknown): asserts value is PublishBundle {
  // 변수에 타입을 단다 — 화살표의 반환 타입만으로는 TS 가 "여기서 끝난다"를 못 읽어
  // 아래 typeof 검사들이 좁혀지지 않는다.
  const fail: (why: string) => never = (why) => {
    throw new CliError(`번들 형식이 올바르지 않습니다: ${why}`, { exitCode: 65 });
  };
  if (typeof value !== "object" || value === null) fail("객체가 아닙니다.");
  const bundle = value as Record<string, unknown>;
  const name = bundle["name"];
  if (typeof name !== "string") fail("name 이 없습니다.");
  // 이름이 곧 경로가 된다 — kebab-case 만 통과시켜 `..` 같은 조각이 들어올 여지를 없앤다.
  assertValidName(name);
  if (typeof bundle["description"] !== "string") fail("description 이 없습니다.");
  if (!Array.isArray(bundle["files"]) || bundle["files"].length === 0) fail("files 가 비었습니다.");
  for (const file of bundle["files"] as unknown[]) {
    if (typeof file !== "object" || file === null) fail("files 항목이 객체가 아닙니다.");
    const f = file as Record<string, unknown>;
    if (typeof f["path"] !== "string" || typeof f["content"] !== "string") {
      fail("files 항목에 path·content 가 필요합니다.");
    }
  }
  const meta = bundle["meta"];
  if (typeof meta !== "object" || meta === null) fail("meta 가 없습니다.");
  const m = meta as Record<string, unknown>;
  if (!isCategory(m["category"])) fail(`meta.category 가 올바르지 않습니다: ${String(m["category"])}`);
  if (!isStatus(m["status"])) fail(`meta.status 가 올바르지 않습니다: ${String(m["status"])}`);
  if (typeof m["summary"] !== "string") fail("meta.summary 가 없습니다.");
  if (typeof m["intent"] !== "string") fail("meta.intent 가 없습니다.");
  if (!Array.isArray(m["keywords"])) fail("meta.keywords 가 없습니다.");
}

export function installBundle(
  config: ResolvedConfig,
  bundle: PublishBundle,
  options: InstallOptions,
): InstallResult {
  const name = assertValidName(bundle.name);
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const paths = elementPaths(dirs, name);

  if (!options.force && entryExists(dirs, name)) {
    throw new CliError(`이미 등록된 컴포넌트입니다: ${name}`, {
      exitCode: 65,
      hint: "덮어쓰려면 --force. 남의 것으로 내 것을 덮기 전에 `ie element get` 으로 먼저 확인하세요.",
    });
  }

  /*
   * ⚠ 번들이 준 `path` 를 그대로 쓰지 않는다.
   *
   * 번들은 인터넷 너머에서 온 데이터다. `path` 를 믿고 쓰면 `../../../.ssh/authorized_keys` 같은
   * 값 하나로 프로젝트 밖에 파일을 쓸 수 있다(경로 탈출). 그래서 **역할만 읽고 경로는 검증된
   * 이름에서 우리가 직접 계산**한다 — 탈출 가능한 경로가 애초에 만들어지지 않는다.
   * 분류되지 않는 파일은 조용히 버린다(모르는 파일을 쓰는 게 바로 그 탈출 경로다).
   */
  const target: Record<Slot, string> = {
    component: paths.component,
    demo: paths.demo,
    index: paths.index,
    cn: `${config.elementsDir}/${LIB_DIR_NAME}/cn.ts`,
  };

  const rel = (path: string) => relative(config.root, path).split("\\").join("/");
  const written: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<Slot>();

  for (const file of bundle.files) {
    const slot = classify(file.path, name);
    if (!slot || seen.has(slot)) continue;
    seen.add(slot);

    const absolute = target[slot];
    // 공유 헬퍼는 이미 있으면 건드리지 않는다 — 내가 고쳐 둔 cn 을 남의 것으로 덮으면
    // 이 컴포넌트 하나 때문에 프로젝트 전체의 클래스 병합 동작이 바뀐다.
    if (slot === "cn" && existsSync(absolute)) {
      skipped.push(rel(absolute));
      continue;
    }
    mkdirSync(absolute.replace(/\/[^/]+$/, ""), { recursive: true });
    writeFileSync(absolute, file.content);
    written.push(rel(absolute));
  }

  if (!seen.has("component")) {
    throw new CliError(`번들에 ${name} 본체가 없습니다.`, { exitCode: 65 });
  }

  // 엔트리는 **내 경로**로 다시 쓴다 — 발행자의 디렉토리 구조가 내 프로젝트와 같을 이유가 없다.
  const installedAt = new Date().toISOString();
  const entry: Entry = {
    $schema: ENTRY_SCHEMA_URL,
    name,
    type: "registry:component",
    description: bundle.description,
    files: [{ path: rel(paths.component), type: "registry:component" }],
    meta: {
      ...bundle.meta,
      /*
       * createdBy·createdAt 은 **설치자·설치 시각**이다.
       *
       * 발행자 것을 그대로 두면 두 가지가 어긋난다. ① 다른 모든 경로에서 createdBy 는 "이
       * 프로젝트에서 이걸 만든 사람"인데 설치한 것만 뜻이 달라진다. ② createdAt 이 발행일이라
       * 오늘 받아온 컴포넌트가 "새로 생김" 필터에 안 잡힌다 — 방금 설치한 걸 목록에서 못 찾는다.
       * 크레딧은 아래 origin 이 온전히 들고 있으므로 잃는 게 없다.
       */
      createdBy: options.actor,
      createdAt: installedAt,
      origin: {
        source: options.source,
        ...(bundle.meta.createdBy ? { publishedBy: bundle.meta.createdBy } : {}),
        ...(bundle.meta.createdAt ? { publishedAt: bundle.meta.createdAt } : {}),
      },
      demo: seen.has("demo") ? rel(paths.demo) : undefined,
    },
  };
  if (!entry.meta.demo) delete entry.meta.demo;
  writeEntry(dirs, entry);
  written.push(rel(paths.entry));

  appendHistory(dirs, name, {
    at: installedAt,
    actor: options.actor,
    action: "created",
    note: bundle.meta.createdBy
      ? `@${bundle.meta.createdBy} 의 컴포넌트를 설치 — ${options.source}`
      : `마켓플레이스에서 설치 — ${options.source}`,
  });

  const index = writeIndex({
    root: config.root,
    elementsDir: config.elementsDir,
    entriesDir: config.entriesDir,
    indexFile: config.indexFile,
  });

  return { entry, written, skipped, indexCount: index.count };
}
