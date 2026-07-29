import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ie-theme";

function currentTheme(): Theme {
  return document.documentElement.dataset["theme"] === "dark" ? "dark" : "light";
}

/**
 * 테마 토글.
 *
 * 초기값은 index.html 의 인라인 스크립트가 이미 정해 뒀다(첫 페인트 전에 확정해야 흰 화면이
 * 번쩍이지 않는다). 여기서는 그 값을 읽어 이어받기만 한다 — 두 곳에서 각자 계산하면 어긋난다.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* 프라이빗 모드 등 — 저장 실패가 토글을 막지 않는다 */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
