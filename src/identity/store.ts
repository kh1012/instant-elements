import { homedir } from "node:os";
import { join } from "node:path";
import { readJsonClassified, writeJsonAtomic } from "../registry/io.js";
import { readGitInfo } from "../cli/project.js";

/**
 * 이 컴퓨터를 쓰는 사람이 누구인가.
 *
 * `credentials.json`(발행 토큰) 옆에 두지만 **같은 파일에 넣지 않는다.** 토큰은 0600 으로 잠근
 * 비밀이고, 신원은 화면에 그대로 뜨는 표시용이다. 하나로 합치면 갤러리 서버가 신원을 읽을
 * 때마다 토큰이 든 파일을 여는 꼴이 된다.
 *
 * 프로젝트가 아니라 홈에 두는 이유: 사람은 여러 프로젝트를 오가도 한 사람이다. 프로젝트마다
 * 두면 레포를 옮길 때마다 다시 정해야 하고, 실수로 커밋되면 남의 레포에 내 이름이 남는다.
 */
export interface Identity {
  /** 화면과 히스토리에 남는 표시 이름. */
  nickname: string;
  /** 아바타 이미지 주소. 없으면 이니셜로 그린다. */
  avatarUrl?: string;
  /** 어디서 온 신원인가. `local` 은 로그인 없이 이름만 정한 경우다. */
  provider: "github" | "google" | "local";
  /** 마켓플레이스 계정과 잇는 열쇠. `local` 이면 없다. */
  login?: string;
}

/** `IE_HOME` 이 있으면 그 아래 — 테스트가 실제 홈을 건드리지 않게 하는 탈출구(credentials 와 동일). */
export function identityPath(): string {
  return join(process.env["IE_HOME"] || homedir(), ".instant", "identity.json");
}

export function readIdentity(): Identity | null {
  const result = readJsonClassified<Identity>(identityPath());
  if (result.status !== "ok") return null;

  // 손으로 고쳤거나 옛 형식일 수 있다. 이름 없는 신원은 신원이 아니므로 없는 것으로 친다.
  const value = result.value;
  if (!value || typeof value.nickname !== "string" || !value.nickname.trim()) return null;
  return value;
}

export function writeIdentity(identity: Identity): void {
  writeJsonAtomic(identityPath(), identity);
}

export function clearIdentity(): void {
  // 지우는 대신 빈 파일로 덮지 않는다 — `readIdentity` 가 손상으로 오해할 여지를 남기지 않는다.
  writeJsonAtomic(identityPath(), {});
}

/**
 * 기록에 남길 이름.
 *
 * 신원이 있으면 그것이 진짜다. git `user.name` 은 폴백일 뿐이다 — 한 레포를 여럿이 쓰거나
 * git 설정이 회사 계정으로 박혀 있을 때, 히스토리에 뜨는 이름은 사람이 정한 쪽이어야 한다.
 *
 * CLI 와 갤러리가 **같은 함수**를 쓴다. 갈라지면 갤러리에는 닉네임이, 에이전트가 남긴
 * `ie element log` 에는 git 이름이 찍혀 같은 사람이 두 명으로 보인다.
 */
export function resolveActorName(root: string): string {
  return readIdentity()?.nickname ?? readGitInfo(root).userName ?? "unknown";
}
