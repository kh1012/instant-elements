import { existsSync, readdirSync } from "node:fs";
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
