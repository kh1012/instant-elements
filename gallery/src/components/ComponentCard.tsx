import { memo, type CSSProperties } from "react";
import galleryConfig from "virtual:ie/config";
import type { Entry } from "instant-elements/registry";
import { cn } from "../lib/cn";
import { togglePin } from "../lib/pins";
import { buildIntegrationPrompt } from "../lib/prompt";
import { isNew } from "../lib/search";
import { Link } from "../router";
import { CopyButton } from "./CopyButton";
import { StatusBadge } from "./StatusBadge";
import { PinIcon } from "./icons";
import { SafePreview } from "./SafePreview";
import { Tooltip } from "./Tooltip";
import { useInView } from "./useInView";

/** 프리뷰가 아직 마운트되지 않은 카드의 자리표시 — 높이를 미리 예약해 스크롤이 밀리지 않게 한다. */
function PreviewSkeleton() {
  return (
    <div className="size-full animate-pulse rounded-md bg-st-muted/30 motion-reduce:animate-none" />
  );
}

/**
 * 목록 카드.
 *
 * ── 카드 전체가 링크다
 * 이름만 링크로 두면 클릭 표적이 글자 폭만큼 좁아진다. 카드 전면에 깔린 `<a>`(stretched link)가
 * 그 역할을 하고, 내부 인터랙션(핀·복사)은 z 로 그 위에 띄운다. 실제 `<a>` 라 키보드·가운데
 * 클릭이 그대로 동작한다.
 *
 * ── 프리뷰를 pointer-events-none 으로 두는 이유
 * 카드 프레임은 작고 클릭은 상세로 가야 한다. 데모가 자기 hover·클릭을 먹으면 카드가 눌리지 않는다.
 *
 * _근거: 상류 하네스 ComponentCard.tsx._
 */
function ComponentCardImpl({
  entry,
  index = 0,
  pinned = false,
}: {
  entry: Entry;
  /** stagger 순서. 목록에서의 위치. */
  index?: number;
  pinned?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const fresh = isNew(entry);
  const prompt = buildIntegrationPrompt(entry, {
    importAlias: galleryConfig.importAlias,
    baseUrl: `http://${galleryConfig.host}:${galleryConfig.port}`,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "stagger-item hover-lift group relative isolate flex flex-col gap-3 overflow-hidden",
        "rounded-xl border border-st-border bg-st-card p-4 shadow-sm",
        "hover:border-st-foreground/20 hover:shadow-xl active:shadow-md",
      )}
      style={{ "--stagger-index": index } as CSSProperties}
    >
      <Link
        to={`/c/${entry.name}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-st-ring"
      >
        <span className="sr-only">{entry.name} 상세 보기</span>
      </Link>

      {/* 고정 — 좌상단이라 우상단 'N' 뱃지와 겹치지 않는다. 고정 시 상시 노출, 아니면 hover 에만. */}
      <span
        className="absolute left-3 top-3 z-20"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          togglePin(entry.name);
        }}
      >
        <Tooltip content={pinned ? "고정 해제" : "자주 쓰는 것으로 고정"}>
          <button
            type="button"
            aria-label={pinned ? `${entry.name} 고정 해제` : `${entry.name} 고정`}
            aria-pressed={pinned}
            className={cn(
              "press grid size-7 place-items-center rounded-lg border bg-st-card/90 backdrop-blur-sm",
              pinned
                ? "border-st-primary/40 text-st-primary opacity-100"
                : "border-st-border text-st-muted-foreground opacity-0 hover:text-st-foreground focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            <PinIcon filled={pinned} width={14} height={14} />
          </button>
        </Tooltip>
      </span>

      {fresh ? (
        <span className="new-badge absolute right-3 top-3 z-20 grid size-5 place-items-center text-step-n2 font-bold leading-none">
          {/* leading-none 라인박스에서 대문자 N 이 하강부 여백 탓에 위로 쏠려 보여, 광학 중앙 보정. */}
          <span aria-hidden data-glyph className="translate-y-[0.11em]">
            N
          </span>
          <span className="sr-only">신규 — 최근 24시간 내 생성</span>
        </span>
      ) : null}

      {/*
        content-visibility:auto — 화면 밖 썸네일의 렌더·애니메이션을 브라우저가 건너뛴다.
        고정 높이라 레이아웃 시프트 없이 오프스크린 부하만 덜어낸다.
      */}
      <div className="preview-surface pointer-events-none flex h-40 items-start justify-center overflow-hidden rounded-lg bg-st-background p-4 [content-visibility:auto]">
        {inView ? (
          <div className="anim-fade-in flex size-full items-start justify-center">
            <SafePreview name={entry.name} />
          </div>
        ) : (
          <PreviewSkeleton />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-step-1 font-medium text-st-foreground">
            {entry.name}
          </span>
          <div className="relative z-10 flex shrink-0 items-center gap-1.5">
            <StatusBadge status={entry.meta.status} />
          </div>
        </div>
        <p className="line-clamp-2 break-keep text-step-n1 leading-relaxed text-st-muted-foreground">
          {entry.meta.summary || entry.meta.intent}
        </p>
      </div>

      {/* mt-auto — 설명 길이가 달라도 카드 밑단이 한 줄에 정렬된다. */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="truncate text-step-n2 text-st-muted-foreground">
          {entry.meta.category} · @{entry.meta.createdBy}
        </span>
        <div className="relative z-10 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={prompt} label="프롬프트 복사" size="sm" />
        </div>
      </div>
    </div>
  );
}

/**
 * memo — 부모가 스크롤·상태 변화로 리렌더돼도 props 가 같으면 카드 수백 개가 함께 다시 그려지지
 * 않게 막는다. 핀 토글 같은 내부 변화는 부모가 `pinned` 로 내려 주므로 여전히 반영된다.
 */
export const ComponentCard = memo(ComponentCardImpl);
