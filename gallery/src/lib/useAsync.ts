import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; value: T };

/**
 * 비동기 데이터 한 건.
 *
 * 데이터 라이브러리를 들이지 않는다 — 갤러리가 부르는 엔드포인트는 두어 개뿐이고, 그 편의를
 * 위해 소비 프로젝트의 번들과 얽힐 의존을 늘릴 이유가 없다. `reload` 로 수동 갱신만 제공한다.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    load()
      .then((value) => {
        // 응답이 늦게 온 이전 요청이 새 결과를 덮어쓰지 않게 한다.
        if (alive) setState({ status: "ready", value });
      })
      .catch((error: unknown) => {
        if (alive) setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
