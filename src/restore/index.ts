import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { CliError } from "../cli/ui.js";
import type { ResolvedConfig } from "../config/types.js";
import { appendHistory, readHistory } from "../registry/history.js";
import { elementPaths } from "../registry/paths.js";

/**
 * 과거 커밋 시점으로 컴포넌트를 되돌린다.
 *
 * ── "기록된다"의 완성형
 * 히스토리에 `sha` 를 남기는 이유가 여기 있다. 어떤 수정이 잘못됐을 때 "그 전으로" 를 사람이
 * git 명령으로 되짚지 않아도 되게 한다 — 갤러리에서 시점을 고르면 그 파일들만 그때 내용으로
 * 되돌아간다.
 *
 * ── 왜 revert 가 아니라 checkout 인가
 * `git revert` 는 그 커밋의 변경 전체를 되돌린다. 우리는 **이 컴포넌트의 파일만** 되돌리고
 * 싶다(같은 커밋에 다른 컴포넌트가 섞여 있을 수 있다). `git checkout <sha> -- <paths>` 가
 * 정확히 그 일을 하고, 결과를 새 커밋으로 남기므로 이력이 끊기지 않는다.
 */

export interface RestorePoint {
  sha: string;
  at: string;
  actor: string;
  note?: string;
}

function git(root: string, args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch (err) {
    const stderr = (err as { stderr?: Buffer }).stderr?.toString().trim();
    throw new CliError(`git ${args[0]} 실패`, {
      exitCode: 70,
      hint: stderr || (err instanceof Error ? err.message : String(err)),
    });
  }
}

/** 되돌릴 수 있는 시점 목록 — 히스토리에 sha 가 남은 이벤트들. */
export function listRestorePoints(config: ResolvedConfig, name: string): RestorePoint[] {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  return readHistory(dirs, name)
    .filter((event): event is typeof event & { sha: string } => Boolean(event.sha))
    .map((event) => ({
      sha: event.sha,
      at: event.at,
      actor: event.actor,
      ...(event.note ? { note: event.note } : {}),
    }));
}

export interface RestoreResult {
  name: string;
  sha: string;
  /** 되돌린 파일들(프로젝트 루트 기준). */
  files: string[];
  /** 이 복원을 담은 새 커밋. */
  commit: string;
}

export function restoreElement(
  config: ResolvedConfig,
  name: string,
  sha: string,
  actor: string,
): RestoreResult {
  const dirs = { elementsDir: config.elementsDir, entriesDir: config.entriesDir };
  const paths = elementPaths(dirs, name);
  const rel = (path: string) => relative(config.root, path).split("\\").join("/");

  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw new CliError(`SHA 형식이 아닙니다: ${sha}`, { exitCode: 64 });
  }

  // 그 시점에 이 컴포넌트가 존재했는지 먼저 확인한다 — 없으면 checkout 이 파일을 지워 버린다.
  const listed = git(config.root, ["ls-tree", "-r", "--name-only", sha, "--", rel(paths.dir)])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (listed.length === 0) {
    throw new CliError(`그 시점에는 ${name} 이 없었습니다: ${sha.slice(0, 7)}`, {
      exitCode: 66,
      hint: "컴포넌트가 만들어지기 전의 커밋이거나, 그때는 다른 경로에 있었습니다.",
    });
  }

  // 작업 트리가 더러우면 멈춘다 — 복원 커밋에 남의 변경이 섞여 들어가면 되돌리기가 더 어려워진다.
  const dirty = git(config.root, ["status", "--porcelain"]);
  if (dirty) {
    throw new CliError("작업 트리에 커밋되지 않은 변경이 있습니다.", {
      exitCode: 75,
      hint: "복원 커밋에 다른 변경이 섞이지 않도록, 먼저 커밋하거나 stash 한 뒤 다시 시도하세요.",
    });
  }

  git(config.root, ["checkout", sha, "--", ...listed]);
  git(config.root, ["add", "--", ...listed]);

  const short = sha.slice(0, 7);
  git(config.root, ["commit", "-m", `revert(${name}): ${short} 시점으로 복원`]);
  const commit = git(config.root, ["rev-parse", "HEAD"]);

  appendHistory(dirs, name, {
    at: new Date().toISOString(),
    actor,
    action: "modified",
    note: `${short} 시점으로 복원`,
    sha: commit,
  });

  return { name, sha, files: listed, commit };
}
