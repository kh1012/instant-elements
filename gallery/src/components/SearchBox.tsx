import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHeaderSearchBox } from "../lib/header-search";
import { pushRecent, readRecent } from "../lib/recent-searches";
import { cn } from "../lib/cn";
import { SHORTCUTS } from "../lib/shortcuts";

/** 자동완성에 띄우는 최대 개수. 화면을 덮지 않으면서 "이 중에 있겠지"가 되는 선. */
const MAX_SUGGESTIONS = 6;
/** 최근 검색어를 적어 두기까지 기다리는 시간. 기록에만 쓰고 필터링은 Enter 로 한다. */
const RECORD_DELAY_MS = 220;

/**
 * 헤더에 꽂히는 검색창.
 *
 * 앱 전체에서 **한 번만** 그려지고 `#header-search-slot` 으로 포털된다(`lib/header-search.tsx`).
 * 라우트가 각자 그리면 화면을 옮길 때마다 언마운트돼 포커스가 날아간다.
 *
 * 등록한 라우트가 없으면 아무것도 그리지 않는다 — 검색이 없는 화면에 빈 입력창이 남으면
 * "여기선 왜 안 되지"가 된다.
 */
export function SearchBox() {
  const { registration, value, setValue, commit } = useHeaderSearchBox();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const scope = registration?.scope;

  /*
   * 헤더가 그려진 뒤에야 슬롯이 생긴다. 렌더 중에 `getElementById` 를 부르면 첫 렌더에서는
   * null 이고 그 뒤로 다시 시도하지 않아 영영 안 뜬다.
   */
  useEffect(() => {
    setSlot(document.getElementById("header-search-slot"));
  });

  useEffect(() => {
    if (scope) setRecent(readRecent(scope));
  }, [scope]);

  /*
   * 최근 검색어는 **기록만** 늦춘다. 필터링은 Enter 로 확정되므로 여기서 지연시켜도 화면이
   * 느려지지 않고, 한 글자씩 지워 가며 고민한 중간 단계가 기록에 남지 않는다.
   */
  useEffect(() => {
    if (!scope || !value.trim()) return;
    const timer = setTimeout(() => setRecent(pushRecent(scope, value)), RECORD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [scope, value]);

  if (!registration || !slot) return null;

  const typed = value.trim();
  // 두 갈래를 **같은 모양**으로 맞춰 둔다. 서로 다른 타입의 합집합이면 아래에서 항목마다
  // "이건 hint 가 있는 쪽인가"를 따져야 하고, 렌더 코드가 그 구분을 떠안는다.
  const options: { id: string; label: string; hint?: string }[] = typed
    ? (registration.suggest?.(typed) ?? []).slice(0, MAX_SUGGESTIONS)
    : // 아직 아무것도 안 쳤으면 최근 검색어를 후보로 보여 준다 — 대개 다시 찾는 것이다.
      recent.map((query) => ({ id: `recent:${query}`, label: query }));
  const open = focused && options.length > 0;

  const choose = (index: number) => {
    const picked = options[index];
    if (!picked) return;
    setCursor(-1);
    if (picked.id.startsWith("recent:")) {
      commit(picked.label);
      return;
    }
    if (registration.onPick) registration.onPick(picked.id);
    else commit(picked.label);
  };

  return createPortal(
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={registration.placeholder}
        value={value}
        placeholder={registration.placeholder}
        onChange={(event) => {
          setValue(event.target.value);
          setCursor(-1);
        }}
        onFocus={() => setFocused(true)}
        // 후보를 마우스로 고르는 중에 닫히지 않게 한 박자 미룬다.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((c) => Math.min(c + 1, options.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((c) => Math.max(c - 1, -1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (cursor >= 0) choose(cursor);
            else commit(value);
          } else if (event.key === "Escape") {
            // 첫 Esc 는 후보만 닫고, 글자는 남긴다 — 지우려던 게 아닐 수 있다.
            if (open) setFocused(false);
            else inputRef.current?.blur();
          }
        }}
        className={cn(
          "h-8 rounded-full border border-st-border bg-st-muted/40 pl-3 pr-8 text-step-n2",
          "outline-none transition-[width] duration-fast placeholder:text-st-muted-foreground",
          "focus-visible:border-st-ring focus-visible:bg-st-background",
          // 포커스하면 넓어진다 — 평소엔 헤더를 차지하지 않고, 쓸 때는 긴 검색어가 보인다.
          focused ? "w-72" : "w-44",
        )}
      />

      {value ? (
        <button
          type="button"
          onClick={() => {
            commit("");
            inputRef.current?.focus();
          }}
          aria-label="검색어 지우기"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-step-n2 text-st-muted-foreground hover:text-st-foreground"
        >
          ✕
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-st-border px-1 text-[0.625rem] leading-tight text-st-muted-foreground"
        >
          {SHORTCUTS.search.keys}
        </kbd>
      )}

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-modal-popover w-72 overflow-hidden rounded-lg border border-st-border bg-st-popover py-1 shadow-lg"
        >
          {!typed ? (
            <li className="px-3 py-1 text-step-n2 text-st-muted-foreground">최근 검색어</li>
          ) : null}
          {options.map((option, index) => (
            <li key={option.id} role="option" aria-selected={index === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => choose(index)}
                className={cn(
                  "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-step-n2",
                  index === cursor ? "bg-st-muted" : "",
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.hint ? (
                  <span className="ml-auto shrink-0 text-step-n2 text-st-muted-foreground">
                    {option.hint}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>,
    slot,
  );
}
