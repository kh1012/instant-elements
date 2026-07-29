import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { CliError } from "../cli/ui.js";

/**
 * 파일 락 — 디렉토리 생성의 원자성을 이용한다.
 *
 * `mkdir` 은 이미 있으면 실패하는 원자적 연산이라, 별도 조율 없이 프로세스 간 상호배제가 된다
 * (CLI 와 갤러리 dev 서버가 같은 페이지를 동시에 쓸 수 있으므로 필요하다).
 *
 * **왜 파일 락과 버전 검사를 둘 다 두나**: 락은 "동시에 쓰지 않게" 하고, 버전은 "내가 읽은 뒤
 * 남이 바꿨는지" 를 잡는다. 락만 있으면 순차적으로 덮어쓰는 lost update 를 못 막는다.
 */

const STALE_MS = 10_000;
const RETRY_MS = 25;
const MAX_WAIT_MS = 5_000;

function lockDir(path: string): string {
  return `${path}.lock`;
}

function sleepSync(ms: number): void {
  // 락 대기는 밀리초 단위라 동기 대기가 단순하고 정확하다(비동기로 만들면 호출부 전체가 전염된다).
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** 죽은 프로세스가 남긴 락을 치운다 — 안 그러면 그 파일을 영원히 못 쓴다. */
function clearIfStale(dir: string): void {
  try {
    const age = Date.now() - statSync(dir).mtimeMs;
    if (age > STALE_MS) rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 이미 사라졌으면 그만이다 */
  }
}

export function withFileLock<T>(path: string, fn: () => T): T {
  const dir = lockDir(path);
  const deadline = Date.now() + MAX_WAIT_MS;

  for (;;) {
    try {
      mkdirSync(dir);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      clearIfStale(dir);
      if (Date.now() > deadline) {
        throw new CliError(`파일이 다른 작업에 잠겨 있습니다: ${path}`, {
          exitCode: 75,
          hint: `${dir} 가 남아 있다면 지운 뒤 다시 시도하세요.`,
        });
      }
      sleepSync(RETRY_MS);
    }
  }

  try {
    // 누가 잡고 있는지 남긴다 — 락이 오래 남았을 때 원인을 찾을 단서.
    writeFileSync(`${dir}/owner`, `${process.pid}\n`);
  } catch {
    /* 부가 정보라 실패해도 진행한다 */
  }

  try {
    return fn();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 락 소유자 pid(진단용). 없으면 null. */
export function lockOwner(path: string): number | null {
  try {
    return Number.parseInt(readFileSync(`${lockDir(path)}/owner`, "utf8").trim(), 10) || null;
  } catch {
    return null;
  }
}
