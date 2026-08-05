import { existsSync, readdirSync, rmSync } from "node:fs";
import { CliError } from "../cli/ui.js";
import { readJsonClassified, writeJsonAtomic } from "../registry/io.js";
import { withFileLock } from "../page/lock.js";
import { fileIn, isValidSlug, normalizeSlug, slugify } from "../page/slug.js";
import { normalizeFlow, type FlowFile } from "./schema.js";

function flowPath(flowsDir: string, slug: string): string {
  const path = fileIn(flowsDir, slug, ".json");
  if (!path) {
    throw new CliError(`잘못된 흐름 슬러그: ${JSON.stringify(slug)}`, { exitCode: 64 });
  }
  return path;
}

export type FlowSummary = FlowFile & { slug: string };

export function listFlows(flowsDir: string): FlowSummary[] {
  let files: string[];
  try {
    files = readdirSync(flowsDir);
  } catch {
    return [];
  }
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => normalizeSlug(f.slice(0, -".json".length)))
    .filter(isValidSlug)
    .map((slug) => {
      const flow = tryReadFlow(flowsDir, slug);
      return flow ? { ...flow, slug } : null;
    })
    .filter((f): f is FlowSummary => f !== null)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function readFlow(flowsDir: string, slug: string): FlowFile {
  const path = flowPath(flowsDir, slug);
  const result = readJsonClassified<unknown>(path);
  if (result.status === "missing") {
    throw new CliError(`흐름을 찾을 수 없습니다: ${slug}`, { exitCode: 66 });
  }
  if (result.status === "corrupt") {
    throw new CliError(`흐름 JSON 이 손상됐습니다: ${slug}`, { exitCode: 65, hint: result.error });
  }
  const flow = normalizeFlow(result.value);
  if (!flow) throw new CliError(`흐름 형식이 올바르지 않습니다: ${slug}`, { exitCode: 65 });
  return flow;
}

export function tryReadFlow(flowsDir: string, slug: string): FlowFile | null {
  try {
    return readFlow(flowsDir, slug);
  } catch {
    return null;
  }
}

export function flowExists(flowsDir: string, slug: string): boolean {
  return isValidSlug(slug) && existsSync(flowPath(flowsDir, slug));
}

/**
 * 흐름에서 화면 하나를 뺀 결과 — **순수 함수**.
 *
 * 화면만 빼면 그 화면을 드나들던 연결이 허공을 가리키고, 시작 화면이었으면 재생이 빈 화면에서
 * 시작한다. 셋을 함께 정리하는 것이 "화면을 뺀다"의 온전한 뜻이다.
 *
 * 세 곳이 이 규칙을 쓴다 — 갤러리의 화면 제외, `ie flow screen --remove`, 그리고 **페이지 삭제
 * 연쇄**. 각자 구현하면 반드시 갈라지고, 갈라진 쪽이 끊긴 연결을 남긴다.
 */
export function withoutScreen(flow: FlowFile, pageSlug: string): FlowFile {
  const screens = flow.screens.filter((s) => s.slug !== pageSlug);
  const next: FlowFile = {
    ...flow,
    screens,
    edges: flow.edges.filter((e) => e.from.slug !== pageSlug && e.to !== pageSlug),
  };

  if (flow.start === pageSlug) {
    const heir = screens[0]?.slug;
    // 남은 화면이 없으면 시작점 자체를 지운다 — 빈 문자열을 두면 "지정됨"으로 읽힌다.
    if (heir) next.start = heir;
    else delete next.start;
  }
  return next;
}

/**
 * 이 페이지를 편입한 **모든** 흐름에서 뺀다. 실제로 바뀐 흐름의 slug 를 돌려준다.
 *
 * 페이지 삭제가 부르는 정리 단계다. 안 하면 흐름이 스냅샷 없는 화면을 안고 재생되고, 그 사실은
 * 재생을 눌러 봐야 안다.
 *
 * 손상된 흐름 하나 때문에 삭제가 통째로 막히면 안 되므로 `listFlows` 가 읽어낸 것만 다룬다
 * (그 함수가 이미 손상된 파일을 건너뛴다).
 */
export function detachPageFromFlows(
  options: { flowsDir: string; actor: string },
  pageSlug: string,
): string[] {
  const touched: string[] = [];
  for (const flow of listFlows(options.flowsDir)) {
    if (!flow.screens.some((s) => s.slug === pageSlug)) continue;
    writeFlow(options, flow.slug, (current) => withoutScreen(current, pageSlug));
    touched.push(flow.slug);
  }
  return touched;
}

/**
 * 흐름 파일을 지운다. 이미 없으면 `false` — **오류가 아니다.**
 *
 * 목록이 조금 옛것이어서 두 번 눌렀을 때 "지웠는데 실패했다"가 뜨는 쪽이 더 혼란스럽다.
 * 부르는 쪽은 "지금 없다"를 원했고 결과가 그렇다.
 *
 * 화면(페이지)은 건드리지 않는다 — 흐름은 페이지를 **참조**할 뿐 소유하지 않는다. 같은 페이지가
 * 여러 흐름에 편입되는 게 정상이다.
 */
export function deleteFlow(flowsDir: string, slug: string): boolean {
  const path = flowPath(flowsDir, slug);
  return withFileLock(path, () => {
    if (!existsSync(path)) return false;
    rmSync(path, { force: true });
    return true;
  });
}

export function createFlow(
  options: { flowsDir: string; actor: string },
  name: string,
): { slug: string; path: string } {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; flowExists(options.flowsDir, slug); i += 1) slug = `${base}-${i}`;

  const path = flowPath(options.flowsDir, slug);
  const flow: FlowFile = {
    version: "1.0.0",
    name: name.trim() || slug,
    updatedAt: new Date().toISOString(),
    updatedBy: options.actor,
    screens: [],
    edges: [],
  };
  return withFileLock(path, () => {
    writeJsonAtomic(path, flow);
    return { slug, path };
  });
}

export function writeFlow(
  options: { flowsDir: string; actor: string },
  slug: string,
  mutate: (flow: FlowFile) => FlowFile,
): FlowFile {
  const path = flowPath(options.flowsDir, slug);
  return withFileLock(path, () => {
    const next = mutate(readFlow(options.flowsDir, slug));
    next.updatedAt = new Date().toISOString();
    next.updatedBy = options.actor;
    writeJsonAtomic(path, next);
    return next;
  });
}
