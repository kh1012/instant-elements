/**
 * CLI 출력 헬퍼 — 의존성 0.
 *
 * 색은 TTY 이고 NO_COLOR/dumb 터미널이 아닐 때만 켠다. 에이전트가 출력을 파싱하는 경우가 많아
 * `--json` 경로에서는 이 모듈의 색을 쓰지 않는다(순수 JSON 만 stdout 으로).
 */

const ESC = "\u001b[";

const useColor =
  process.stdout.isTTY === true &&
  !process.env["NO_COLOR"] &&
  process.env["TERM"] !== "dumb" &&
  process.env["FORCE_COLOR"] !== "0";

function wrap(open: number, close: number) {
  return (s: string): string => (useColor ? `${ESC}${open}m${s}${ESC}${close}m` : s);
}

export const color = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
};

export const symbols = {
  ok: "✓",
  fail: "✗",
  warn: "!",
  info: "·",
};

export function info(message: string): void {
  console.log(message);
}

export function ok(message: string): void {
  console.log(`${color.green(symbols.ok)} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${color.yellow(symbols.warn)} ${message}`);
}

export function error(message: string): void {
  console.error(`${color.red(symbols.fail)} ${message}`);
}

/** stdout 으로 JSON 만 내보낸다(에이전트·스크립트 소비용). */
export function emitJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/**
 * 사용자에게 보여줄 수 있는 실패. CLI 최상단이 이걸 잡아 메시지 + exitCode 로 끝낸다
 * (스택 트레이스를 쏟지 않는다 — 사용자 잘못이지 버그가 아니다).
 */
export class CliError extends Error {
  readonly exitCode: number;
  readonly hint: string | undefined;

  constructor(message: string, options?: { exitCode?: number; hint?: string }) {
    super(message);
    this.name = "CliError";
    this.exitCode = options?.exitCode ?? 1;
    this.hint = options?.hint;
  }
}
