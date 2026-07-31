import { useMemo, useState } from "react";
import entries from "virtual:ie/entries";
import historyByName from "virtual:ie/history";
import galleryConfig from "virtual:ie/config";
import type { ElementCategory, Entry } from "instant-elements/registry";
import { ComponentCard } from "../components/ComponentCard";
import { cn } from "../lib/cn";
import { isNew, searchEntries, sortEntries, type SortKey } from "../lib/search";
import { partitionByPin, usePins } from "../lib/pins";
import { useScrollRestore } from "../lib/scroll-restore";
import { navigate, useQuery } from "../router";

/**
 * 활동 필터 — "방금 뭘 건드렸더라"에 답한다.
 *
 * 로컬 개발 도구에서는 이게 분류 필터보다 자주 쓰인다. 에이전트를 몇 번 돌리고 나면 목록에서
 * 방금 만든 것과 방금 고친 것을 다시 찾아야 하는데, 이름을 기억 못 하면 방법이 없었다.
 */
type Activity = "all" | "new" | "touched";

const ACTIVITY_LABEL: Record<Activity, string> = {
  all: "전체",
  new: "새로 생김",
  touched: "오늘 수정됨",
};

function touchedToday(entry: Entry, now: number): boolean {
  const events = historyByName[entry.name] ?? [];
  // 히스토리는 최신순이라 첫 항목만 보면 된다.
  const last = events[0];
  if (!last) return false;
  const at = Date.parse(last.at);
  return Number.isFinite(at) && now - at < 24 * 60 * 60 * 1000;
}

function matchesActivity(entry: Entry, activity: Activity, now: number): boolean {
  if (activity === "new") return isNew(entry, now);
  if (activity === "touched") return touchedToday(entry, now);
  return true;
}

const CATEGORY_FILTERS: (ElementCategory | "all")[] = ["all", "Composite", "Animations", "System"];

const CATEGORY_LABEL: Record<string, string> = {
  all: "전체",
  Composite: "Composite",
  Animations: "Animations",
  System: "System",
};

/** 필터·정렬 상태를 URL 에 둔다 — 그래야 "이 목록"을 그대로 공유·북마크할 수 있다. */
function setParam(params: URLSearchParams, key: string, value: string | null): void {
  if (value === null || value === "" || value === "all") params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  navigate(query ? `/?${query}` : "/", { replace: true });
}

export function LibraryRoute() {
  const params = useQuery();
  const pins = usePins();
  const [query, setQuery] = useState(() => params.get("q") ?? "");

  const category = params.get("category") ?? "all";
  const sort = (params.get("sort") === "recent" ? "recent" : "name") as SortKey;
  const activityParam = params.get("activity");
  const activity: Activity =
    activityParam === "new" || activityParam === "touched" ? activityParam : "all";

  const filtered = useMemo(() => {
    const now = Date.now();
    const byCategory =
      category === "all" ? entries : entries.filter((e) => e.meta.category === category);
    const byActivity = byCategory.filter((e) => matchesActivity(e, activity, now));
    return sortEntries(searchEntries(byActivity, query), sort);
  }, [category, query, sort, activity]);

  // 필터를 거는 중에는 위치를 되살리지 않는다 — 목록이 짧아져 엉뚱한 자리로 튄다.
  useScrollRestore(query.trim() === "" && category === "all" && activity === "all");

  const { pinned: pinnedItems, rest: restItems } = useMemo(
    () => partitionByPin(filtered, pins, (entry) => entry.name),
    [filtered, pins],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>([["all", entries.length]]);
    for (const entry of entries) {
      map.set(entry.meta.category, (map.get(entry.meta.category) ?? 0) + 1);
    }
    return map;
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-xl bg-st-muted px-6 py-10 text-center">
        <h1 className="text-step-2 font-semibold">라이브러리</h1>
        <p className="mx-auto mt-2 max-w-xl text-step-n1 text-st-muted-foreground">
          역할을 설명하면 만들어지고, 여기에 쌓입니다. 필요한 컴포넌트가 이미 있는지 먼저 찾아
          보세요.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setParam(new URLSearchParams(params), "q", event.target.value);
            }}
            placeholder="역할·이름·검색어로 찾기"
            className="h-10 w-full rounded-md border border-st-border bg-st-card px-3 text-step-n1 shadow-lg placeholder:text-st-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring"
          />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_FILTERS.map((value) => {
            const count = counts.get(value) ?? 0;
            if (value !== "all" && count === 0) return null;
            const active = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setParam(new URLSearchParams(params), "category", value)}
                className={cn(
                  "press rounded-md px-2.5 py-1 text-step-n2",
                  active
                    ? "bg-st-primary text-st-primary-foreground"
                    : "bg-st-muted text-st-muted-foreground hover:bg-st-interactive-muted-hover-bg",
                )}
              >
                {CATEGORY_LABEL[value] ?? value}
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          {(["all", "new", "touched"] as Activity[]).map((value) => {
            // 해당하는 게 없는 필터는 아예 안 보여 준다 — 눌러서 0건을 보는 건 정보가 아니다.
            const now = Date.now();
            const count =
              value === "all" ? entries.length : entries.filter((e) => matchesActivity(e, value, now)).length;
            if (value !== "all" && count === 0) return null;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setParam(new URLSearchParams(params), "activity", value)}
                className={cn(
                  "press rounded-md px-2.5 py-1 text-step-n2",
                  activity === value
                    ? "bg-st-muted text-st-foreground"
                    : "text-st-muted-foreground hover:bg-st-interactive-muted-hover-bg",
                )}
              >
                {ACTIVITY_LABEL[value]}
                {value !== "all" ? <span className="ml-1.5 opacity-70">{count}</span> : null}
              </button>
            );
          })}
          <span aria-hidden className="mx-1 h-4 w-px bg-st-border" />
          {(["name", "recent"] as SortKey[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam(new URLSearchParams(params), "sort", value)}
              className={cn(
                "press rounded-md px-2.5 py-1 text-step-n2",
                sort === value
                  ? "bg-st-muted text-st-foreground"
                  : "text-st-muted-foreground hover:bg-st-interactive-muted-hover-bg",
              )}
            >
              {value === "name" ? "이름순" : "최신순"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasEntries={entries.length > 0} importAlias={galleryConfig.importAlias} />
      ) : (
        <div className="anim-fade-up mt-6 flex flex-col gap-8">
          {/*
            고정된 것을 위로 올리고 아래 목록에서는 뺀다 — 같은 카드가 두 번 나오면
            "고정됨"이 별도 구획이 아니라 그냥 중복으로 읽힌다.
          */}
          {pinnedItems.length > 0 ? (
            <section>
              <h2 className="mb-3 text-step-n1 font-medium text-st-muted-foreground">
                고정됨 <span className="opacity-70">{pinnedItems.length}</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pinnedItems.map((entry, i) => (
                  <ComponentCard key={entry.name} entry={entry} index={i} pinned query={query} />
                ))}
              </div>
            </section>
          ) : null}

          {restItems.length > 0 ? (
            <section>
              {pinnedItems.length > 0 ? (
                <h2 className="mb-3 text-step-n1 font-medium text-st-muted-foreground">
                  전체 <span className="opacity-70">{restItems.length}</span>
                </h2>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {restItems.map((entry, i) => (
                  <ComponentCard key={entry.name} entry={entry} index={i} query={query} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasEntries, importAlias }: { hasEntries: boolean; importAlias: string }) {
  return (
    <div className="anim-fade-up mt-8 rounded-lg border border-dashed border-st-border p-12 text-center">
      {hasEntries ? (
        <>
          <p className="text-step-0 font-medium">조건에 맞는 컴포넌트가 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            검색어를 줄이거나 필터를 전체로 되돌려 보세요.
          </p>
        </>
      ) : (
        <>
          <p className="text-step-0 font-medium">아직 컴포넌트가 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            첫 컴포넌트를 만들면 여기에 쌓이고, <code>{importAlias}/&lt;name&gt;</code> 으로 바로
            쓸 수 있습니다.
          </p>
          <pre className="mx-auto mt-4 w-fit rounded-md bg-st-muted px-3 py-2 text-step-n2 font-mono">
            ie element new stat-card --intent &quot;…&quot; --summary &quot;…&quot;
          </pre>
        </>
      )}
    </div>
  );
}
