import { useEffect, useMemo, useState } from "react";
import entries from "virtual:ie/entries";
import { cn } from "../lib/cn";
import { searchEntries } from "../lib/search";
import { navigate } from "../router";

/**
 * 커맨드 팔레트 (⌘K · Ctrl+K · `/`).
 *
 * 레지스트리가 수십 개를 넘어가면 목록으로 돌아가 스크롤하는 왕복이 주 비용이 된다.
 * 여기서 이름만 치면 바로 그 컴포넌트로 간다 — 지금 어느 화면에 있든.
 *
 * 검색 자체는 목록과 **같은 함수**를 쓴다. 두 곳이 다르게 찾으면 "목록엔 있는데 팔레트엔
 * 안 나온다"가 되고, 그 순간 둘 다 못 믿게 된다.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // `/` 는 입력 중이 아닐 때만 — 글을 쓰다가 슬래시를 치면 팔레트가 뜨면 안 된다.
      if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }, [open]);

  const results = useMemo(() => searchEntries(entries, query).slice(0, 8), [query]);

  if (!open) return null;

  const go = (name: string) => {
    setOpen(false);
    navigate(`/c/${name}`);
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-st-border bg-st-popover shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          // autoFocus 로 마운트 시점에 포커스가 붙는다. requestAnimationFrame 으로 미루면
          // 한 프레임 사이에 친 글자가 통째로 유실된다(빠른 입력에서 실제로 겪었다).
          // eslint-disable-next-line jsx-a11y/no-autofocus -- 팔레트는 열자마자 타이핑하는 표면이다.
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (event.key === "Enter") {
              const picked = results[cursor];
              if (picked) go(picked.name);
            }
          }}
          placeholder="컴포넌트 찾기"
          className="w-full border-b border-st-border bg-transparent px-4 py-3 text-step-0 text-st-popover-foreground outline-none placeholder:text-st-muted-foreground"
        />

        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-step-n1 text-st-muted-foreground">
            {entries.length === 0 ? "아직 컴포넌트가 없습니다." : "맞는 컴포넌트가 없습니다."}
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.map((entry, index) => (
              <li key={entry.name}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => go(entry.name)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left",
                    index === cursor ? "bg-st-muted" : "",
                  )}
                >
                  <span className="text-step-n1 font-medium">{entry.name}</span>
                  <span className="line-clamp-1 text-step-n2 text-st-muted-foreground">
                    {entry.meta.summary || entry.meta.intent}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 border-t border-st-border px-4 py-2 text-step-n2 text-st-muted-foreground">
          <span>↑↓ 이동</span>
          <span>↵ 열기</span>
          <span>esc 닫기</span>
        </div>
      </div>
    </div>
  );
}
