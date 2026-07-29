import { listEntries, hasDemo } from "./entry.js";
import { writeJsonAtomic } from "./io.js";
import type { RegistryDirs } from "./paths.js";
import type { IndexComponent, RegistryIndex } from "./schema.js";

export const INDEX_NOTE = "손으로 수정하지 마세요 — `ie index` 로 재생성됩니다.";
export const INDEX_GENERATOR = "instant-elements/ie index";

export interface BuildIndexDirs extends RegistryDirs {
  root: string;
  indexFile: string;
}

/**
 * `entries/*.json` → `index.json` 을 **결정적으로** 재생성한다.
 *
 * 결정성이 핵심이다: 같은 엔트리 집합이면 출력이 항상 바이트 단위로 같아야 한다. 그래서
 * 이름으로 정렬하고 **타임스탬프를 넣지 않는다** — 넣는 순간 두 사람이 각자 재생성만 해도
 * git diff 가 나고, 머지 충돌이 의미 없이 쌓인다.
 *
 * index 는 경량 요약이다. 에이전트가 재사용 후보를 고를 때 이 파일 하나만 읽으면 되도록
 * 최소 필드만 싣고, 더 필요하면 그때 개별 엔트리를 연다(컨텍스트 비용 절감).
 */
export function buildIndex(dirs: BuildIndexDirs): RegistryIndex {
  const components: IndexComponent[] = listEntries(dirs).map((entry) => ({
    name: entry.name,
    status: entry.meta.status,
    category: entry.meta.category,
    intent: String(entry.meta.intent ?? entry.description ?? "").trim(),
    summary: String(entry.meta.summary ?? "").trim(),
    keywords: Array.isArray(entry.meta.keywords) ? entry.meta.keywords : [],
    hasDemo: hasDemo(dirs, entry),
  }));

  components.sort((a, b) => a.name.localeCompare(b.name));

  return {
    generator: INDEX_GENERATOR,
    note: INDEX_NOTE,
    count: components.length,
    components,
  };
}

export function writeIndex(dirs: BuildIndexDirs): RegistryIndex {
  const index = buildIndex(dirs);
  writeJsonAtomic(dirs.indexFile, index);
  return index;
}
