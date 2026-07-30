import { useEffect, useState, type ReactNode } from "react";
import galleryConfig from "virtual:ie/config";
import entries from "virtual:ie/entries";
import { cn } from "../lib/cn";
import { Link } from "../router";
import { useTheme } from "../theme";
import { Tooltip } from "./Tooltip";
import { CommandIcon, FlowIcon, GridIcon, MoonIcon, PageIcon, SunIcon } from "./icons";

export type Section = "library" | "pages" | "flows";

// 표기는 실제 눌러야 하는 키와 같아야 한다 — 단축키를 **글자로 알려 주는 게** 이 버튼의 목적이라
// mac 에 Ctrl 이라고 적으면 없느니만 못하다(핸들러는 metaKey·ctrlKey 를 둘 다 받는다).
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const PALETTE_KEYS = IS_MAC ? "⌘ K" : "Ctrl K";

/**
 * 앱 셸의 네비게이션.
 *
 * **전폭 띠가 아니라 떠 있는 pill 이다.** 본문이 라우트마다 다른 폭을 쓰는데 헤더만 전폭으로
 * 깔리면 그 띠가 화면의 기준선처럼 읽혀 본문 폭이 매번 어긋나 보인다.
 *
 * 아이콘만 쓰고 이름은 툴팁으로 낸다 — 라벨 셋을 늘어놓으면 pill 이 화면 절반을 먹는다.
 *
 * _근거: 상류 하네스 AppShell.tsx._
 */
export function AppHeader({ active }: { active: Section }) {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openPalette = () => {
    // 팔레트는 자기 키 핸들러를 갖고 있다 — 상태를 위로 끌어올리는 대신 같은 이벤트를 쏜다.
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: IS_MAC, ctrlKey: !IS_MAC }),
    );
  };

  return (
    <header className="sticky top-0 z-20 flex justify-center px-6 pb-3 pt-6">
      <div
        data-scrolled={scrolled}
        className="header-elevate flex w-fit items-center gap-2 rounded-full border border-st-border bg-st-background/80 px-4 py-3 shadow-lg backdrop-blur-md"
      >
        <nav className="flex shrink-0 gap-1">
          <NavIcon to="/" active={active === "library"} label="컴포넌트">
            <GridIcon />
          </NavIcon>
          <NavIcon to="/pages" active={active === "pages"} label="페이지">
            <PageIcon />
          </NavIcon>
          <NavIcon to="/flows" active={active === "flows"} label="흐름">
            <FlowIcon />
          </NavIcon>
        </nav>

        {/* 유틸 아이콘도 ghost 로 통일 — 테두리 없이 hover 틴트만. 네비와 한 결. */}
        <Tooltip content={theme === "dark" ? "라이트 모드로" : "다크 모드로"}>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
            className="press grid size-8 place-items-center rounded-lg text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </Tooltip>

        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-st-border/50" />

        {/*
          전역 팔레트는 ⌘K 를 아는 사람만 쓰던 기능이다 — 손잡이를 세워 **눌러서도** 열리게 하고
          툴팁이 단축키를 글자로 알려 준다. 아이콘이 ⌘ 자체라 툴팁 전에도 힌트가 된다.
        */}
        <Tooltip
          content={
            <span className="flex items-center gap-1.5">
              전체 검색
              <kbd className="rounded border border-st-border px-1 py-0.5 leading-none">
                {PALETTE_KEYS}
              </kbd>
            </span>
          }
        >
          <button
            type="button"
            onClick={openPalette}
            aria-label={`전체 검색 (${PALETTE_KEYS})`}
            aria-keyshortcuts={IS_MAC ? "Meta+K" : "Control+K"}
            className="press grid size-8 shrink-0 place-items-center rounded-lg text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground"
          >
            <CommandIcon />
          </button>
        </Tooltip>

        <span className="shrink-0 pl-1 pr-1 text-step-n2 text-st-muted-foreground">
          {galleryConfig.title}
          <span className="ml-2 opacity-60">{entries.length}</span>
        </span>
      </div>
    </header>
  );
}

function NavIcon({
  to,
  active,
  label,
  children,
}: {
  to: string;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <Link
        to={to}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "press grid size-8 place-items-center rounded-lg",
          active
            ? "bg-st-muted text-st-foreground"
            : "text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground",
        )}
      >
        {children}
      </Link>
    </Tooltip>
  );
}
