import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";

/**
 * 경량 라우터 — 외부 라우팅 의존 0.
 *
 * 갤러리의 라우트는 서너 개뿐이고 중첩도 없다. 라우팅 라이브러리를 들이면 갤러리가 소비
 * 프로젝트의 React 버전·번들러와 얽힐 표면만 늘어난다. history API 로 충분하다.
 */

const NAV_EVENT = "ie:navigate";

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener("popstate", sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  return path;
}

export function navigate(to: string, options?: { replace?: boolean }): void {
  if (options?.replace) window.history.replaceState({}, "", to);
  else window.history.pushState({}, "", to);
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** 쿼리스트링을 읽는다. 목록의 검색·필터 상태가 URL 에 남아 그대로 공유된다. */
export function useQuery(): URLSearchParams {
  const path = usePath();
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    setSearch(window.location.search);
  }, [path]);

  useEffect(() => {
    const sync = () => setSearch(window.location.search);
    window.addEventListener("popstate", sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  return new URLSearchParams(search);
}

export function Link({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const handle = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      // 새 탭·다운로드 같은 브라우저 기본 동작은 가로채지 않는다.
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (event.button !== 0) return;
      event.preventDefault();
      onClick?.();
      navigate(to);
    },
    [to, onClick],
  );

  return (
    <a href={to} onClick={handle} className={className}>
      {children}
    </a>
  );
}

/** 슬러그 디코딩 — `%zz` 같은 깨진 인코딩이 화면 전체를 죽이지 않게 원문으로 폴백한다. */
export function safeDecode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
