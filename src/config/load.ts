import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { CliError } from "../cli/ui.js";

/**
 * 설정 파일을 원시 객체로 읽는다.
 *
 * `.ts` 설정을 1급으로 지원하려고 jiti 를 쓴다. Node 22.6+ 의 타입 스트리핑에 기대면 Node 20 사용자가
 * 떨어져 나가고, 번들러에 기대면 CLI 가 프로젝트 빌드 설정에 종속된다 — jiti 는 그 둘 다 피한다.
 * jiti 는 실제로 `.ts` 설정을 만났을 때만 동적 import 되므로 JSON/JS 만 쓰는 프로젝트는 비용이 0이다.
 */
export async function loadConfigFile(file: string): Promise<unknown> {
  const ext = extname(file).toLowerCase();

  if (ext === ".json") {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch (err) {
      throw new CliError(`설정 파일을 파싱하지 못했습니다: ${file}`, {
        exitCode: 78,
        hint: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const loaded = await jiti.import(file, { default: true });
    return loaded;
  } catch (err) {
    throw new CliError(`설정 파일을 불러오지 못했습니다: ${file}`, {
      exitCode: 78,
      hint: err instanceof Error ? err.message : String(err),
    });
  }
}

/** package.json 의 `instantElements` 필드 — 설정 파일 없이 가볍게 쓰고 싶을 때의 폴백. */
export function readPackageJsonConfig(packageJsonFile: string): {
  config: unknown;
  name: string | null;
} {
  try {
    const parsed = JSON.parse(readFileSync(packageJsonFile, "utf8")) as Record<string, unknown>;
    return {
      config: parsed["instantElements"],
      name: typeof parsed["name"] === "string" ? parsed["name"] : null,
    };
  } catch {
    return { config: undefined, name: null };
  }
}
