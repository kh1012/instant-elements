import { useEffect, useRef, useState } from "react";
import type { Entry } from "instant-elements/registry";
import { cn } from "../lib/cn";
import { ComponentCard } from "../components/ComponentCard";
import { ComponentRow } from "../components/ComponentRow";
import { rememberListOrder } from "./DetailRoute.header";
import type { LibraryQuery } from "./LibraryRoute.types";

/**
 * 점프 레일을 띄울 최소 폭.
 *
 * 레일은 본문 오른쪽 바깥에 절대배치되므로, 본문(max-w-6xl = 72rem)과 레일과 여백이 모두
 * 들어갈 만큼 넓을 때만 뜻이 있다. 좁은 화면에서는 본문을 덮거나 화면 밖으로 나간다.
 */
const RAIL_MIN_WIDTH = 1560;

export function LibraryResults({
  entries,
  pins,
  query,
  search,
  runningNames,
}: {
  entries: Entry[];
  pins: Set<string> | string[];
  query: LibraryQuery;
  /** 검색어 — 하이라이트에 쓴다. */
  search: string;
  /** 지금 에이전트가 돌고 있는 컴포넌트 이름들. */
  runningNames: Set<string>;
}) {
  const pinned = new Set(pins);

  /*
   * 지금 보이는 순서를 남긴다. 상세 화면의 ←/→ 가 이걸 읽어 **방금 보던 목록**을 따라간다 —
   * 전체 배열 인덱스를 쓰면 "오늘 수정됨"을 보다가 화살표를 눌렀을 때 화면에 없던 것으로 튄다.
   */
  useEffect(() => {
    rememberListOrder(entries.map((entry) => entry.name));
  }, [entries]);

  if (query.view === "list") {
    return (
      <div className="anim-fade-up mt-4 overflow-hidden rounded-xl border border-st-border">
        {entries.map((entry) => (
          <ComponentRow
            key={entry.name}
            entry={entry}
            pinned={pinned.has(entry.name)}
            query={search}
            running={runningNames.has(entry.name)}
            compact={query.density === "compact"}
          />
        ))}
      </div>
    );
  }

  // 분류순일 때만 묶는다. 이름순·최신순에서 묶으면 정렬 기준과 구획이 서로 다른 말을 한다.
  if (query.sort === "category") {
    return <GroupedGrid entries={entries} pinned={pinned} query={query} search={search} runningNames={runningNames} />;
  }

  return <Grid entries={entries} pinned={pinned} query={query} search={search} runningNames={runningNames} />;
}

function Grid({
  entries,
  pinned,
  query,
  search,
  runningNames,
  offset = 0,
}: {
  entries: Entry[];
  pinned: Set<string>;
  query: LibraryQuery;
  search: string;
  runningNames: Set<string>;
  offset?: number;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        query.density === "compact"
          ? "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {entries.map((entry, i) => (
        <ComponentCard
          key={entry.name}
          entry={entry}
          index={offset + i}
          pinned={pinned.has(entry.name)}
          query={search}
          running={runningNames.has(entry.name)}
          mode={query.card}
          compact={query.density === "compact"}
        />
      ))}
    </div>
  );
}

/**
 * 분류별 섹션 + 오른쪽 점프 레일.
 *
 * 레일의 활성 표시는 **스크롤 위치로** 정한다(scroll-spy). 눌러서 이동한 것만 표시하면,
 * 손으로 스크롤했을 때 레일이 엉뚱한 곳을 가리켜 오히려 방향을 잃는다.
 */
function GroupedGrid({
  entries,
  pinned,
  query,
  search,
  runningNames,
}: {
  entries: Entry[];
  pinned: Set<string>;
  query: LibraryQuery;
  search: string;
  runningNames: Set<string>;
}) {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.meta.category) ?? [];
    list.push(entry);
    groups.set(entry.meta.category, list);
  }
  const sections = [...groups.entries()];

  const [active, setActive] = useState<string | null>(sections[0]?.[0] ?? null);
  const [railOn, setRailOn] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 좁은 화면에서는 IntersectionObserver 를 아예 걸지 않는다 — 레일이 없는데 관찰만 도는 건 낭비다.
  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${RAIL_MIN_WIDTH}px)`);
    const sync = () => setRailOn(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!railOn) return;
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (records) => {
        // 화면에 걸친 섹션 중 **가장 위**를 활성으로 본다. 여럿이 동시에 보일 때 아래 것이
        // 이기면, 스크롤을 내리는 도중에 표시가 두 칸씩 튄다.
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.getAttribute("data-category"));
      },
      // 헤더에 가린 영역은 "보이는 것"이 아니다 — 위쪽 여백을 헤더 높이만큼 깎는다.
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const el of root.querySelectorAll("[data-category]")) observer.observe(el);
    return () => observer.disconnect();
  }, [railOn, entries.length]);

  let offset = 0;
  return (
    <div ref={rootRef} className="anim-fade-up relative mt-4">
      {sections.map(([category, items]) => {
        const start = offset;
        offset += items.length;
        return (
          <section key={category} data-category={category} className="scroll-mt-24 pt-6 first:pt-0">
            <h2 className="mb-3 text-step-n1 font-medium text-st-muted-foreground">
              {category} <span className="opacity-70">{items.length}</span>
            </h2>
            <Grid
              entries={items}
              pinned={pinned}
              query={query}
              search={search}
              runningNames={runningNames}
              offset={start}
            />
          </section>
        );
      })}

      {railOn && sections.length > 1 ? (
        <nav
          aria-label="분류로 이동"
          className="absolute left-full top-0 ml-8 hidden h-full [--rail:1] xl:block"
        >
          <ul className="sticky top-28 flex flex-col gap-1">
            {sections.map(([category, items]) => (
              <li key={category}>
                <a
                  href={`#${category}`}
                  onClick={(event) => {
                    event.preventDefault();
                    rootRef.current
                      ?.querySelector(`[data-category="${category}"]`)
                      ?.scrollIntoView({ block: "start" });
                  }}
                  className={cn(
                    "block whitespace-nowrap rounded-full px-2.5 py-1 text-step-n2",
                    active === category
                      ? "bg-st-muted text-st-foreground"
                      : "text-st-muted-foreground hover:text-st-foreground",
                  )}
                >
                  {category} <span className="opacity-70">{items.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
