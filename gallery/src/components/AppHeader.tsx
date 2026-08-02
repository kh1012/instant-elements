import { useEffect, useState, type ReactNode } from "react";
import galleryConfig from "virtual:ie/config";
import { cn } from "../lib/cn";
import { Link } from "../router";
import { hasMod, SHORTCUTS } from "../lib/shortcuts";
import { useTheme } from "../theme";
import { AgentNav } from "./AgentNav";
import { BackToTop } from "./BackToTop";
import { HeaderAvatarButton } from "./HeaderAvatarButton";
import { Tooltip } from "./Tooltip";
import {
  CommandIcon,
  FlowIcon,
  GridIcon,
  HelpIcon,
  MoonIcon,
  PageIcon,
  SunIcon,
} from "./icons";

export type Section = "library" | "pages" | "flows";

/**
 * 앱 셸의 네비게이션.
 *
 * **전폭 띠가 아니라 떠 있는 pill 이다.** 본문이 라우트마다 다른 폭을 쓰는데 헤더만 전폭으로
 * 깔리면 그 띠가 화면의 기준선처럼 읽혀 본문 폭이 매번 어긋나 보인다.
 *
 * pill 은 **둘**이다. 왼쪽은 "어디로 갈까"(화면 전환), 오른쪽은 "무엇을 할까"(검색·도구).
 * 하나에 몰아넣었더니 검색창이 들어오면서 pill 이 화면을 가로지르고, 네비 아이콘과 유틸
 * 아이콘이 한 줄에 섞여 무엇이 이동이고 무엇이 동작인지 구분되지 않았다.
 *
 * _근거: 상류 하네스 AppShell.tsx._
 */
export function AppHeader({
  active,
  onOpenIdentity,
}: {
  active: Section;
  onOpenIdentity: () => void;
}) {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!hasMod(event) || !event.shiftKey || event.key.toLowerCase() !== "l") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const openPalette = () => {
    // 팔레트는 자기 키 핸들러를 갖고 있다 — 상태를 위로 끌어올리는 대신 같은 이벤트를 쏜다.
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }),
    );
  };

  const pill =
    "header-elevate flex items-center gap-2 rounded-full border border-st-border bg-st-background/80 px-3 py-2 shadow-lg backdrop-blur-md";

  return (
    <>
      <header className="sticky top-0 z-20 flex justify-center gap-3 px-6 pb-3 pt-6">
        <div data-scrolled={scrolled} className={cn(pill, "shrink-0")}>
          {/*
            어느 프로젝트를 서빙 중인지. 여러 프로젝트를 오가며 포트를 여럿 띄우면 화면만 보고는
            구분이 안 된다 — 개수는 뺐다(툴바가 이미 센다).
          */}
          <span className="max-w-40 truncate pl-1.5 pr-0.5 text-step-n2 text-st-muted-foreground">
            {galleryConfig.title}
          </span>
          <span aria-hidden className="h-5 w-px shrink-0 bg-st-border/50" />
          <nav aria-label="화면 전환" className="flex shrink-0 gap-1">
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
        </div>

        <div data-scrolled={scrolled} className={pill}>
          {/*
            검색창이 들어오는 자리. 입력창 자체는 앱에서 한 번만 그려지고 여기로 포털된다
            (`components/SearchBox.tsx`) — 라우트마다 그리면 화면을 옮길 때 포커스가 날아간다.
            검색을 등록한 라우트가 없으면 이 칸은 그냥 비어 있다.
          */}
          <div id="header-search-slot" className="empty:hidden" />

          <IconButton
            onClick={openPalette}
            label="전체 검색"
            shortcut={SHORTCUTS.palette}
          >
            <CommandIcon />
          </IconButton>

          <span aria-hidden data-header-divider className="mx-0.5 h-5 w-px shrink-0 bg-st-border/50" />

          <AgentNav />

          <IconButton
            onClick={toggle}
            label={theme === "dark" ? "라이트 모드로" : "다크 모드로"}
            shortcut={SHORTCUTS.theme}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </IconButton>

          <IconButton
            // 목록 자체는 `?` 를 듣는 ShortcutsDialog 가 갖고 있다 — 같은 키를 쏴서 연다.
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }))
            }
            label="단축키"
            shortcut={SHORTCUTS.help}
          >
            <HelpIcon />
          </IconButton>

          <HeaderAvatarButton onEdit={onOpenIdentity} />
        </div>
      </header>

      <BackToTop visible={scrolled} />
    </>
  );
}

function IconButton({
  onClick,
  label,
  shortcut,
  children,
}: {
  onClick: () => void;
  label: string;
  shortcut?: { keys: string; aria: string };
  children: ReactNode;
}) {
  return (
    <Tooltip
      content={
        shortcut ? (
          <span className="flex items-center gap-1.5">
            {label}
            <kbd className="rounded border border-st-border px-1 py-0.5 leading-none">
              {shortcut.keys}
            </kbd>
          </span>
        ) : (
          label
        )
      }
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={shortcut ? `${label} (${shortcut.keys})` : label}
        {...(shortcut ? { "aria-keyshortcuts": shortcut.aria } : {})}
        className="press grid size-8 shrink-0 place-items-center rounded-lg text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground"
      >
        {children}
      </button>
    </Tooltip>
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
