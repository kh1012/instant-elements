import { chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonClassified, writeJsonAtomic } from "../registry/io.js";

/**
 * 발행 자격증명 — 로컬 registry(`.instant/`)와는 완전히 별개다. registry 는 프로젝트마다
 * 커밋되는 데이터지만, 이건 사람 하나의 GitHub 로그인이라 홈 디렉토리에 둔다.
 */
export interface Credentials {
  githubLogin: string;
  token: string;
}

/** `IE_HOME` 이 있으면 그 아래에 둔다 — 테스트가 실제 홈 디렉토리를 건드리지 않게 하는 탈출구. */
export function credentialsPath(): string {
  return join(process.env["IE_HOME"] || homedir(), ".instant", "credentials.json");
}

export function readCredentials(): Credentials | null {
  const result = readJsonClassified<Credentials>(credentialsPath());
  return result.status === "ok" ? result.value : null;
}

/** 토큰이 담기므로 그룹·기타 사용자에게는 아예 안 보이게 0600 으로 좁힌다. */
export function writeCredentials(credentials: Credentials): void {
  const path = credentialsPath();
  writeJsonAtomic(path, credentials);
  chmodSync(path, 0o600);
}
