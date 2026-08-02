import { createContext, useContext } from "react";

/**
 * 이 컴퓨터를 쓰는 사람.
 *
 * 상류는 닉네임을 localStorage 에 두고 모든 `/api/*` 요청에 `x-harness-nickname` 헤더를 붙이려고
 * `window.fetch` 를 전역으로 덮어썼다. 여기서는 신원이 **서버 디스크**(`~/.instant/identity.json`)에
 * 있으므로 서버가 직접 읽는다 — 헤더도, fetch 가로채기도 필요 없다. 브라우저와 CLI 가 같은
 * 파일을 보므로 둘이 어긋날 여지도 없다.
 */
export interface Identity {
  nickname: string;
  avatarUrl?: string;
  provider: "github" | "google" | "local";
  login?: string;
}

export interface IdentityState {
  identity: Identity | null;
  /** 폴백으로 쓰이는 git `user.name`. 팝오버에서 "무엇이 쓰이는 중인지" 설명하는 데 쓴다. */
  gitUserName: string | null;
  /** 첫 조회가 끝나기 전 — 이 동안 모달을 띄우면 신원이 있는 사람에게도 잠깐 깜빡인다. */
  loading: boolean;
  save: (nickname: string) => Promise<void>;
  unlink: () => Promise<void>;
  /**
   * 마켓플레이스로 보내 로그인시킨다. 성공하면 이 탭이 갤러리로 되돌아온다.
   *
   * 어느 제공자로 갈지를 여기서 넘긴다 — 안 넘기면 두 버튼이 같은 화면으로 가서
   * "GitHub 으로 계속하기"를 눌렀는데 다시 고르라는 화면이 뜬다.
   */
  startLink: (provider: "github" | "google") => Promise<void>;
}

export const IdentityContext = createContext<IdentityState | null>(null);

export function useIdentity(): IdentityState {
  const value = useContext(IdentityContext);
  if (!value) throw new Error("useIdentity 는 IdentityProvider 안에서만 쓸 수 있습니다.");
  return value;
}

/**
 * 히스토리에 남은 이름 → 아바타 주소.
 *
 * **나 자신만 그림이고 나머지는 이니셜이다.**
 *
 * 상류는 닉네임→아바타 맵(`nicknames.json`)을 레포에 커밋해 팀원 아바타를 공유했지만, 그러려면
 * 서버가 사용자 레포에 자동으로 커밋해야 한다(그건 안 한다). `github.com/<이름>.png` 로 추측해
 * 가져오는 방법도 있는데, 그러면 **히스토리에 있는 모든 사람의 이름이 GitHub 로 새어 나간다** —
 * 지금 이 갤러리는 바깥으로 요청을 하나도 보내지 않는 로컬 도구다. 그 성질을 아바타 그림 하나와
 * 바꾸지 않는다.
 *
 * 그래서 아는 것만 쓴다: 내가 로그인해서 받아 둔 내 아바타. 나머지는 이니셜 원형으로 충분히
 * 구분된다(색이 이름에서 결정되므로 사람마다 다르다).
 */
export function avatarUrlFor(actor: string, identity: Identity | null): string | undefined {
  return identity && actor === identity.nickname ? identity.avatarUrl : undefined;
}
