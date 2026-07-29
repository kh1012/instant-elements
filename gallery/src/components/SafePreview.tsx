import { Component, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import demoLoaders from "virtual:ie/demos";

/**
 * lazy 컴포넌트는 **모듈 스코프에서 한 번만** 만든다.
 *
 * 렌더 안에서(useMemo 로 감싸더라도) 만들면 안 된다 — React 는 useMemo 캐시를 언제든 버릴 수 있고,
 * 그때마다 새 lazy 가 생겨 새 promise 를 던진다. 결과적으로 Suspense 가 영원히 fallback 에 머문다
 * (실제로 이 버그를 겪었다: 데모는 정상인데 카드가 계속 "불러오는 중…"). 이름당 하나로 고정하면
 * promise 도 하나라 정상적으로 해소된다.
 */
const lazyDemos: Record<string, ComponentType> = {};
for (const [name, loader] of Object.entries(demoLoaders)) {
  lazyDemos[name] = lazy(loader);
}

/**
 * 데모 하나가 갤러리 전체를 죽이지 않게 한다.
 *
 * 데모는 방금 에이전트가 만든 코드다 — 던지는 게 정상이다. 경계가 없으면 카드 하나의 실패로
 * 목록 전체가 흰 화면이 되고, 그러면 "무엇이 깨졌는지" 볼 수단마저 사라진다.
 */
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    // 콘솔에는 남긴다 — 화면은 조용해도 원인은 추적 가능해야 한다.
    console.error("[instant-elements] 데모 렌더 실패:", error);
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Placeholder({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-24 w-full items-center justify-center rounded-md border border-dashed border-st-border px-4 text-center text-step-n2 text-st-muted-foreground">
      {message}
    </div>
  );
}

export function SafePreview({ name }: { name: string }) {
  const Demo = lazyDemos[name];
  if (!Demo) return <Placeholder message="데모 파일이 없습니다" />;

  return (
    <Boundary fallback={<Placeholder message="데모를 그리지 못했습니다" />}>
      <Suspense fallback={<Placeholder message="불러오는 중…" />}>
        <Demo />
      </Suspense>
    </Boundary>
  );
}

export function hasDemoFor(name: string): boolean {
  return Boolean(demoLoaders[name]);
}
