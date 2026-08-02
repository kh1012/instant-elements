import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { IdentityContext, type Identity, type IdentityState } from "../lib/identity";

interface Payload {
  identity: Identity | null;
  gitUserName: string | null;
}

/**
 * 신원 상태를 앱 최상단에 한 번만 둔다.
 *
 * 헤더의 아바타와 첫 진입 모달과 히스토리의 작성자 표시가 **같은 값**을 봐야 한다. 각자
 * `/api/identity` 를 부르면 하나가 저장된 뒤에도 다른 쪽은 옛 값을 들고 있게 된다.
 */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<Payload>({ identity: null, gitUserName: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void fetch("/api/identity", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? (response.json() as Promise<Payload>) : null))
      .then((data) => {
        if (!alive) return;
        if (data) setPayload(data);
      })
      // 신원을 못 읽어도 갤러리는 떠야 한다 — 이름이 없을 뿐이다.
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (nickname: string) => {
    const response = await fetch("/api/identity", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ nickname }),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = (await response.json()) as { identity: Identity };
    setPayload((prev) => ({ ...prev, identity: data.identity }));
  }, []);

  const unlink = useCallback(async () => {
    await fetch("/api/identity", { method: "DELETE", headers: { accept: "application/json" } });
    setPayload((prev) => ({ ...prev, identity: null }));
  }, []);

  const startLink = useCallback(async (provider: "github" | "google") => {
    const response = await fetch("/api/identity/link", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ provider }),
    });
    if (!response.ok) throw new Error(await response.text());
    const { url } = (await response.json()) as { url: string };

    /*
     * 새 탭이 아니라 **이 탭을 그대로 보낸다.** 새 탭으로 열면 로그인이 끝난 뒤 갤러리 탭이
     * 둘이 되고, 원래 탭은 자기가 연결됐다는 걸 모른 채 남는다. 같은 탭이면 콜백이 갤러리로
     * 되돌려 보내면서 새 신원으로 다시 뜬다.
     */
    window.location.href = url;
  }, []);

  const value = useMemo<IdentityState>(
    () => ({ ...payload, loading, save, unlink, startLink }),
    [payload, loading, save, unlink, startLink],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
