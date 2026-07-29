import type { Entry } from "instant-elements/registry";
import { Link } from "../router";
import { isNew } from "../lib/search";
import { togglePin } from "../lib/pins";
import { CopyIcon, StarIcon } from "./icons";
import { CopyButton } from "./CopyButton";
import { buildIntegrationPrompt } from "../lib/prompt";
import galleryConfig from "virtual:ie/config";
import { Tooltip } from "./Tooltip";
import { CategoryBadge, NewBadge, StatusBadge } from "./StatusBadge";
import { SafePreview } from "./SafePreview";
import { useInView } from "./useInView";
import { cn } from "../lib/cn";

/**
 * 목록 카드.
 *
 * 프리뷰 영역은 미리 자리를 잡아 두고 **뷰포트 근처에 왔을 때만** 실제 데모를 마운트한다.
 * 자리를 먼저 잡는 이유: 나중에 채우면 스크롤 위치가 밀려 읽던 자리를 잃는다.
 */
export function ComponentCard({ entry, pinned = false }: { entry: Entry; pinned?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <Link
      to={`/c/${entry.name}`}
      className="press group relative flex flex-col overflow-hidden rounded-lg border border-st-border bg-st-card hover:-translate-y-1 hover:shadow-lg"
    >
      {/* 카드 전체가 링크라 별표 클릭이 이동으로 새지 않게 전파를 끊는다. */}
      {/* 카드에서 바로 복사 — 가져다 쓰려는 사람은 상세를 열 이유가 없다. */}
      <span
        className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <CopyButton
          icon={<CopyIcon width={14} height={14} />}
          label={`${entry.name} 통합 프롬프트 복사`}
          copiedLabel="복사됨"
          tooltip="다른 화면에 이 컴포넌트를 가져다 쓰라고 시킨다"
          className="h-7 w-7 bg-st-card/80 backdrop-blur"
          text={buildIntegrationPrompt(entry, {
            importAlias: galleryConfig.importAlias,
            baseUrl: `http://${galleryConfig.host}:${galleryConfig.port}`,
          })}
        />
      </span>

      <span
        className="absolute right-2 top-2 z-10"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          togglePin(entry.name);
        }}
      >
        <Tooltip content={pinned ? "고정 해제" : "자주 쓰는 것으로 고정"}>
          <button
            type="button"
            aria-label={pinned ? "고정 해제" : "고정"}
            aria-pressed={pinned}
            className={cn(
              "press inline-flex h-7 w-7 items-center justify-center rounded-md",
              pinned
                ? "text-st-warning opacity-100"
                : "text-st-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <StarIcon filled={pinned} width={14} height={14} />
          </button>
        </Tooltip>
      </span>

      <div
        ref={ref}
        className="preview-surface flex h-40 items-center justify-center overflow-hidden bg-st-background p-4"
      >
        {inView ? (
          <div className="scale-90">
            <SafePreview name={entry.name} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-st-border p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-step-n1 font-medium text-st-card-foreground">{entry.name}</span>
          {isNew(entry) ? <NewBadge /> : null}
        </div>
        <p className="line-clamp-2 text-step-n2 text-st-muted-foreground">
          {entry.meta.summary || entry.meta.intent}
        </p>
        <div className="flex items-center gap-1.5 pt-0.5">
          <CategoryBadge category={entry.meta.category} />
          <StatusBadge status={entry.meta.status} />
        </div>
      </div>
    </Link>
  );
}
