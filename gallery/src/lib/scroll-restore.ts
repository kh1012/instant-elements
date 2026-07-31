import { useEffect } from "react";

/**
 * 목록 스크롤 위치를 기억했다가 돌아왔을 때 되살린다.
 *
 * 훑다가 하나 열어 보고 목록으로 돌아오는 게 이 도구의 기본 동선인데, 매번 맨 위로 튀면
 * 보던 자리를 손으로 다시 찾아야 한다. 컴포넌트가 수십 개만 돼도 이 왕복 비용이 커진다.
 *
 * `sessionStorage` 인 이유: 지금 이 탐색 흐름의 상태다. 내일 새 탭에서 지난번 스크롤 위치로
 * 복원되면 오히려 당황스럽다.
 */
const KEY = "ie:list-scroll";

export function useScrollRestore(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    // 복원은 다음 프레임에 — 이 시점엔 카드가 아직 안 그려져 문서 높이가 모자라 못 내려간다.
    const raf = requestAnimationFrame(() => {
      const saved = Number.parseInt(sessionStorage.getItem(KEY) ?? "", 10);
      if (Number.isFinite(saved) && saved > 0) window.scrollTo(0, saved);
    });

    const save = (): void => {
      try {
        sessionStorage.setItem(KEY, String(window.scrollY));
      } catch {
        /* 저장 실패가 탐색을 막지 않는다 */
      }
    };
    // 언마운트(=다른 화면으로 이동) 직전 값이 우리가 되살려야 할 위치다.
    window.addEventListener("scroll", save, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", save);
      save();
    };
  }, [enabled]);
}
