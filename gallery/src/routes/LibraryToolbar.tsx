import { cn } from "../lib/cn";
import { Tooltip } from "../components/Tooltip";
import {
  DensityIcon,
  ResetIcon,
  ViewGridIcon,
  ViewListIcon,
} from "../components/icons";
import { LibrarySelector, type SelectorOption } from "./LibrarySelector";
import {
  ACTIVITIES,
  ACTIVITY_LABEL,
  ACTIVITY_NOTE,
  CATEGORIES,
  SORT_LABEL,
  type Activity,
  type CardMode,
  type CategoryFilter,
  type LibraryQuery,
  type Sort,
  type View,
} from "./LibraryRoute.types";

/**
 * 라이브러리 툴바.
 *
 * 왼쪽은 **무엇을 볼까**(거르기), 오른쪽은 **어떻게 볼까**(정렬·표시). 섞어 두면 어떤 버튼이
 * 목록의 내용을 바꾸고 어떤 것이 모양만 바꾸는지 매번 눌러 봐야 안다.
 *
 * deprecated 는 다른 축과 **독립된 체크박스**다. 활동·분류 어디에 넣어도 "새로 생긴 것 중
 * deprecated"처럼 조합이 필요한 경우를 표현할 수 없다.
 */
export function LibraryToolbar({
  query,
  set,
  reset,
  dirty,
  activityCounts,
  categoryCounts,
  deprecatedCount,
}: {
  query: LibraryQuery;
  set: <K extends keyof LibraryQuery>(key: K, value: LibraryQuery[K]) => void;
  reset: () => void;
  dirty: boolean;
  activityCounts: Record<Activity, number>;
  categoryCounts: Record<string, number>;
  deprecatedCount: number;
}) {
  const activityOptions: SelectorOption<Activity>[] = ACTIVITIES.map((value) => ({
    value,
    label: ACTIVITY_LABEL[value],
    count: activityCounts[value],
    note: ACTIVITY_NOTE[value],
  }));

  const categoryOptions: SelectorOption<CategoryFilter>[] = CATEGORIES.map((value) => ({
    value,
    label: value === "all" ? "전체 분류" : value,
    count: categoryCounts[value] ?? 0,
  }));

  const sortOptions: SelectorOption<Sort>[] = (["name", "recent", "category"] as Sort[]).map(
    (value) => ({ value, label: SORT_LABEL[value] }),
  );

  const cardOptions: SelectorOption<CardMode>[] = [
    { value: "live", label: "라이브 미리보기" },
    { value: "summary", label: "요약만" },
  ];

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <LibrarySelector
        label="활동"
        options={activityOptions}
        value={query.activity}
        onChange={(next) => set("activity", next)}
      />
      <LibrarySelector
        label="분류"
        options={categoryOptions}
        value={query.category}
        onChange={(next) => set("category", next)}
      />

      {/* deprecated 가 하나도 없으면 이 축을 켤 이유가 없다 — 그때는 아예 그리지 않는다. */}
      {deprecatedCount > 0 ? (
        <label
          className={cn(
            "press inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-step-n2",
            query.deprecated
              ? "border-st-foreground/25 bg-st-muted text-st-foreground"
              : "border-st-border text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground",
          )}
        >
          <input
            type="checkbox"
            checked={query.deprecated}
            onChange={(event) => set("deprecated", event.target.checked)}
            className="size-3.5 accent-st-primary"
          />
          deprecated 포함
          <span className="opacity-70">{deprecatedCount}</span>
        </label>
      ) : null}

      {dirty ? (
        <Tooltip content="모든 필터를 기본값으로">
          <button
            type="button"
            onClick={reset}
            className="press inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-step-n2 text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground"
          >
            <ResetIcon width={13} height={13} />
            초기화
          </button>
        </Tooltip>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <LibrarySelector
          label="정렬"
          options={sortOptions}
          value={query.sort}
          onChange={(next) => set("sort", next)}
        />
        <LibrarySelector
          label="미리보기"
          options={cardOptions}
          value={query.card}
          onChange={(next) => set("card", next)}
        />

        {/* 밀도는 그리드에서만 뜻이 있다 — 목록 뷰는 이미 한 줄씩이다. */}
        {query.view === "grid" ? (
          <Tooltip content={query.density === "compact" ? "여유 있게" : "빽빽하게"}>
            <button
              type="button"
              aria-pressed={query.density === "compact"}
              onClick={() =>
                set("density", query.density === "compact" ? "comfortable" : "compact")
              }
              aria-label="카드 밀도"
              className={cn(
                "press grid size-8 place-items-center rounded-full",
                query.density === "compact"
                  ? "bg-st-primary text-st-primary-foreground"
                  : "text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground",
              )}
            >
              <DensityIcon width={15} height={15} />
            </button>
          </Tooltip>
        ) : null}

        <ViewToggle value={query.view} onChange={(next) => set("view", next)} />
      </div>
    </div>
  );
}

/**
 * 그리드 ↔ 목록.
 *
 * 둘뿐이라 선택기로 접지 않고 세그먼트로 편다 — 두 개짜리 팝오버는 여는 동작이 고르는 동작보다
 * 비싸다.
 */
function ViewToggle({ value, onChange }: { value: View; onChange: (next: View) => void }) {
  const items: { value: View; label: string; icon: typeof ViewGridIcon }[] = [
    { value: "grid", label: "그리드", icon: ViewGridIcon },
    { value: "list", label: "목록", icon: ViewListIcon },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-st-border p-0.5">
      {items.map((item) => (
        <Tooltip key={item.value} content={item.label}>
          <button
            type="button"
            aria-pressed={value === item.value}
            aria-label={`${item.label} 보기`}
            onClick={() => onChange(item.value)}
            className={cn(
              "press grid size-7 place-items-center rounded-full",
              value === item.value
                ? "bg-st-muted text-st-foreground"
                : "text-st-muted-foreground hover:text-st-foreground",
            )}
          >
            <item.icon width={14} height={14} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
