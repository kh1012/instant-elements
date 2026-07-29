import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";

/**
 * 원자적 쓰기 + fsync.
 *
 * 같은 디렉토리에 tmp 를 쓰고 rename 한다(동일 볼륨에서 rename 은 원자적). 레지스트리는 사람과
 * 에이전트와 갤러리 서버가 동시에 만지는 파일이라, 쓰다 만 반쪽 JSON 이 남으면 다음 읽기가
 * "손상"과 "없음"을 구분하지 못한다. tmp 이름에 pid·카운터를 넣어 같은 프로세스의 동시 쓰기도 충돌하지 않게 한다.
 */
let writeCounter = 0;

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}.${(writeCounter += 1)}`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* tmp 정리는 best-effort */
    }
    throw err;
  }
}

export type Classified<T> =
  | { status: "ok"; value: T }
  | { status: "missing" }
  | { status: "corrupt"; error: string };

/**
 * 존재·손상·정상을 구분해 읽는다.
 *
 * 손상을 "없음"으로 뭉개면 다음 쓰기가 그 파일을 신규로 덮어써 내용을 조용히 날린다.
 * 세 상태를 분리해 호출자가 "복구할지 / 새로 만들지"를 스스로 정하게 한다.
 */
export function readJsonClassified<T>(path: string): Classified<T> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { status: "missing" };
  }
  try {
    return { status: "ok", value: JSON.parse(raw) as T };
  } catch (err) {
    return { status: "corrupt", error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 이벤트 1줄을 append.
 *
 * `O_APPEND`(flag "a") 로 열면 커널이 매 write 를 파일 끝에 이어붙인다. 이벤트 한 줄은 4KB 보다
 * 훨씬 작으므로 여러 writer(CLI·갤러리 서버·다른 프로세스)가 동시에 써도 라인이 섞이지 않는다.
 * 히스토리는 부가 기록이라 실패해도 본 작업을 되돌리지 않는다.
 */
export function appendLine(path: string, line: string): void {
  mkdirSync(dirname(path), { recursive: true });
  let fd: number | null = null;
  try {
    fd = openSync(path, "a");
    writeSync(fd, line.endsWith("\n") ? line : `${line}\n`);
    fsyncSync(fd);
  } catch {
    /* best-effort: 기록 실패가 저장을 막지 않는다 */
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* noop */
      }
    }
  }
}

/** JSONL 을 줄 단위로 읽는다. 깨진 줄은 건너뛴다 — 한 줄의 손상이 전체 이력을 못 읽게 만들면 안 된다. */
export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      /* 깨진 줄 skip */
    }
  }
  return out;
}
