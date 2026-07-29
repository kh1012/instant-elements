import { useEffect, useState } from "react";

/**
 * 뷰포트 근처에 들어왔는지.
 *
 * 카드 프리뷰를 전부 즉시 마운트하면 컴포넌트가 수십 개만 돼도 초기 렌더가 무거워진다
 * (각 데모가 자기 청크를 가져오므로 네트워크도 함께 터진다). 한 번 보이면 다시 숨기지 않는다 —
 * 스크롤을 오르내릴 때마다 마운트/언마운트가 반복되면 오히려 더 비싸다.
 *
 * ── 옵저버 수명을 effect 가 통째로 소유하는 이유
 * 처음엔 ref 콜백에서 옵저버를 만들고 언마운트 effect 에서 정리했는데, StrictMode 의 이중 호출에서
 * **effect 정리가 마지막 ref 부착보다 뒤에 실행돼** 옵저버가 끊긴 채 남았다. 그래서 카드가 영원히
 * 비어 있었다(데모는 멀쩡한데 요청조차 나가지 않음). 노드를 state 로 들고 생성·해제를 한 effect
 * 안에 두면 그 순서 문제가 구조적으로 사라진다.
 */
export function useInView<T extends Element>(rootMargin = "200px"): {
  ref: (node: T | null) => void;
  inView: boolean;
} {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!node || inView) return;

    // 이 환경에 IntersectionObserver 가 없으면(구형·테스트 환경) 지연 없이 바로 보여준다 —
    // 최적화가 안 되는 것보다 안 보이는 게 나쁘다.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, rootMargin]);

  return { ref: setNode, inView };
}
