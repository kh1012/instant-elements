import { useMemo } from "react";
import entries from "virtual:ie/entries";
import historyByName from "virtual:ie/history";
import galleryConfig from "virtual:ie/config";
import type { Entry } from "instant-elements/registry";
import { CreateComposer } from "../components/CreateComposer";
import { useAgent } from "../lib/agent-store";
import { useHeaderSearch } from "../lib/header-search";
import { isNew, searchEntries, sortEntries } from "../lib/search";
import { partitionByPin, usePins } from "../lib/pins";
import { useScrollRestore } from "../lib/scroll-restore";
import { navigate } from "../router";
import { LibraryResults } from "./LibraryResults";
import { ACTIVITIES, type Activity, type LibraryQuery } from "./LibraryRoute.types";
import { LibraryToolbar } from "./LibraryToolbar";
import { useLibraryQueryState } from "./use-library-query-state";

const DAY_MS = 24 * 60 * 60 * 1000;

function touchedToday(entry: Entry, now: number): boolean {
  const events = historyByName[entry.name] ?? [];
  // 히스토리는 최신순이라 첫 항목만 보면 된다.
  const last = events[0];
  if (!last) return false;
  const at = Date.parse(last.at);
  return Number.isFinite(at) && now - at < DAY_MS;
}

function matchesActivity(
  entry: Entry,
  activity: Activity,
  now: number,
  running: Set<string>,
): boolean {
  if (activity === "new") return isNew(entry, now);
  if (activity === "running") return running.has(entry.name);
  if (activity === "touched") return touchedToday(entry, now);
  return true;
}

/**
 * 헤더 검색창의 자동완성 후보.
 *
 * 목록 필터와 **같은 함수**로 찾는다 — 둘이 다르게 찾으면 "자동완성엔 떴는데 목록엔 없다"가
 * 되고, 그 순간 둘 다 못 믿게 된다.
 */
function suggestEntries(query: string) {
  return searchEntries(entries, query).map((entry) => ({
    id: entry.name,
    label: entry.name,
    hint: entry.meta.category,
  }));
}

/**
 * 컴포넌트 갤러리.
 *
 * 툴바·결과·URL 동기화를 각자 파일로 뺐다. 한 파일에 있을 때는 필터 하나를 더할 때마다
 * 상태 계산과 마크업이 함께 부풀어, "이 칩이 무엇을 거르는지"를 읽어 내는 데 파일 전체를
 * 훑어야 했다.
 */
export function LibraryRoute() {
  const pins = usePins();
  const { query, set, reset, dirty } = useLibraryQueryState();
  const { runs } = useAgent();

  /*
   * 검색은 헤더가 갖고 있다. 여기서는 "이 화면에서는 컴포넌트를 이렇게 찾는다"만 등록하고,
   * 거르기에는 확정된 값(`committed`)을 쓴다 — 매 글자마다 목록 전체를 다시 거르면 입력이 밀린다.
   */
  const { committed: search } = useHeaderSearch(
    {
      scope: "component",
      placeholder: "역할·이름·검색어로 찾기",
      suggest: suggestEntries,
      // 후보를 고르면 검색어로 좁히는 대신 곧바로 그 컴포넌트로 간다 — 이름을 아는 사람의 지름길.
      onPick: (name) => navigate(`/c/${name}`),
    },
    typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );

  /** 지금 에이전트가 돌고 있는 컴포넌트. "실행 중" 필터와 카드의 링이 이걸 함께 본다. */
  const runningNames = useMemo(
    () =>
      new Set(
        runs
          .filter((run) => run.status === "running")
          .map((run) => /^\/c\/(.+)$/.exec(run.contextHref)?.[1])
          .filter((name): name is string => Boolean(name)),
      ),
    [runs],
  );

  /**
   * deprecated 는 **기본적으로 감춘다.**
   *
   * 대체된 컴포넌트가 목록에 섞여 있으면 새로 쓸 것을 고를 때마다 걸러 내야 한다. 다만 지우지는
   * 않는다 — 이미 쓰고 있는 화면이 있고, "이건 왜 사라졌지"에 답할 자리가 필요하다.
   */
  const visible = useMemo(
    () => (query.deprecated ? entries : entries.filter((e) => e.meta.status !== "deprecated")),
    [query.deprecated],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const byCategory =
      query.category === "all" ? visible : visible.filter((e) => e.meta.category === query.category);
    const byActivity = byCategory.filter((e) =>
      matchesActivity(e, query.activity, now, runningNames),
    );
    const found = searchEntries(byActivity, search);
    // 분류순은 정렬이 아니라 **묶기**다 — 묶음 안은 이름순이어야 찾을 수 있다.
    return sortEntries(found, query.sort === "category" ? "name" : query.sort);
  }, [visible, query.category, query.activity, query.sort, search, runningNames]);

  // 필터를 거는 중에는 위치를 되살리지 않는다 — 목록이 짧아져 엉뚱한 자리로 튄다.
  useScrollRestore(search.trim() === "" && !dirty);

  const { pinned: pinnedItems, rest: restItems } = useMemo(
    () => partitionByPin(filtered, pins, (entry) => entry.name),
    [filtered, pins],
  );

  /*
   * 개수는 **다른 축을 고정한 채** 센다. 예컨대 분류를 Composite 으로 좁힌 상태에서 활동
   * 선택기의 숫자는 "Composite 중 오늘 수정된 것"이어야 한다 — 전체 기준으로 세면 눌렀을 때
   * 나오는 개수와 달라 숫자를 못 믿게 된다.
   */
  const counts = useMemo(() => {
    const now = Date.now();
    const forActivity =
      query.category === "all" ? visible : visible.filter((e) => e.meta.category === query.category);

    const activity = Object.fromEntries(
      ACTIVITIES.map((value) => [
        value,
        forActivity.filter((e) => matchesActivity(e, value, now, runningNames)).length,
      ]),
    ) as Record<Activity, number>;

    const forCategory = visible.filter((e) =>
      matchesActivity(e, query.activity, now, runningNames),
    );
    const category: Record<string, number> = { all: forCategory.length };
    for (const entry of forCategory) {
      category[entry.meta.category] = (category[entry.meta.category] ?? 0) + 1;
    }

    return { activity, category };
  }, [visible, query.category, query.activity, runningNames]);

  const deprecatedCount = useMemo(
    () => entries.filter((e) => e.meta.status === "deprecated").length,
    [],
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/*
        히어로에서 배경 박스와 검색창을 걷어냈다.
        - 검색은 헤더로 올라갔다. 여기 두면 스크롤을 내린 뒤에는 검색하러 위로 올라와야 한다.
        - `bg-st-muted` 박스는 목록 위에 두 번째 헤더처럼 앉아, 진짜 헤더와 카드 사이에서
          시선이 한 번 더 걸렸다. 제목과 한 줄 설명이면 이 화면이 무엇인지 말하기에 충분하다.
      */}
      <section className="py-6 text-center">
        <h1 className="text-step-2 font-semibold">컴포넌트 갤러리</h1>
        <p className="mx-auto mt-2 max-w-xl text-step-n1 text-st-muted-foreground">
          역할을 설명하면 만들어지고, 여기에 쌓입니다. 필요한 컴포넌트가 이미 있는지 먼저 찾아
          보세요.
        </p>
      </section>

      {/* 히어로 바로 아래가 생성 진입점 자리다 — "없네" 를 알게 되는 순간과 만드는 순간을 붙인다. */}
      <CreateComposer />

      <LibraryToolbar
        query={query}
        set={set}
        reset={reset}
        dirty={dirty}
        activityCounts={counts.activity}
        categoryCounts={counts.category}
        deprecatedCount={deprecatedCount}
      />

      {filtered.length === 0 ? (
        <EmptyState
          hasEntries={entries.length > 0}
          filtering={dirty || search.trim() !== ""}
          importAlias={galleryConfig.importAlias}
          onReset={reset}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-8">
          {/*
            고정된 것을 위로 올리고 아래 목록에서는 뺀다 — 같은 카드가 두 번 나오면
            "고정됨"이 별도 구획이 아니라 그냥 중복으로 읽힌다.
            고정 구획은 분류로 묶지 않는다 — 이미 사람이 손으로 고른 묶음이다.
          */}
          {pinnedItems.length > 0 ? (
            <section>
              <h2 className="mb-3 mt-4 text-step-n1 font-medium text-st-muted-foreground">
                고정됨 <span className="opacity-70">{pinnedItems.length}</span>
              </h2>
              <LibraryResults
                entries={pinnedItems}
                pins={pins}
                query={{ ...query, sort: "name" } satisfies LibraryQuery}
                search={search}
                runningNames={runningNames}
              />
            </section>
          ) : null}

          {restItems.length > 0 ? (
            <section>
              {pinnedItems.length > 0 ? (
                <h2 className="mb-3 text-step-n1 font-medium text-st-muted-foreground">
                  전체 <span className="opacity-70">{restItems.length}</span>
                </h2>
              ) : null}
              <LibraryResults
                entries={restItems}
                pins={pins}
                query={query}
                search={search}
                runningNames={runningNames}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasEntries,
  filtering,
  importAlias,
  onReset,
}: {
  hasEntries: boolean;
  /** 필터·검색 때문에 비었는가, 아니면 정말 아무것도 없는가. */
  filtering: boolean;
  importAlias: string;
  onReset: () => void;
}) {
  return (
    <div className="anim-fade-up mt-8 rounded-xl border border-dashed border-st-border p-12 text-center">
      {hasEntries ? (
        <>
          <p className="text-step-0 font-medium">조건에 맞는 컴포넌트가 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            검색어를 줄이거나 필터를 되돌려 보세요.
          </p>
          {/* 빠져나갈 길을 빈 화면 안에 둔다 — 툴바까지 눈을 되돌리지 않아도 되게. */}
          {filtering ? (
            <button
              type="button"
              onClick={onReset}
              className="press mt-4 rounded-full border border-st-border px-3 py-1 text-step-n2 hover:bg-st-muted/60"
            >
              필터 초기화
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-step-0 font-medium">아직 컴포넌트가 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            첫 컴포넌트를 만들면 여기에 쌓이고, <code>{importAlias}/&lt;name&gt;</code> 으로 바로
            쓸 수 있습니다. 위의 생성 버튼을 눌러 보세요.
          </p>
          <pre className="mx-auto mt-4 w-fit rounded-md bg-st-muted px-3 py-2 text-step-n2 font-mono">
            ie element new stat-card --intent &quot;…&quot; --summary &quot;…&quot;
          </pre>
        </>
      )}
    </div>
  );
}
