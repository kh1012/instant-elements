import { useEffect, useRef, useState } from "react";
import type { Entry } from "instant-elements/registry";
import { CopyButton } from "../components/CopyButton";
import { Popover } from "../components/Popover";
import { CategoryBadge, StatusBadge } from "../components/StatusBadge";
import { Tooltip } from "../components/Tooltip";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  KebabIcon,
  SplitIcon,
  StarIcon,
  WandIcon,
} from "../components/icons";
import { cn } from "../lib/cn";
import { togglePin } from "../lib/pins";
import {
  buildIntegrationPrompt,
  buildModifyPrompt,
  buildSplitPrompt,
  componentNameOf,
  importPathFor,
  type PromptContext,
} from "../lib/prompt";
import { Link, navigate } from "../router";
import { DetailRunControl } from "./DetailRunControl";

/**
 * 상세 화면 머리.
 *
 * ── 이전/다음이 왜 목록 순서를 따라야 하나
 * 예전에는 `entries` 배열 인덱스를 썼다. 그러면 이름순으로 정렬된 전체 목록을 훑는데,
 * 정작 사람이 방금 보고 온 목록은 "오늘 수정됨 · 최신순"일 수 있다 — 화살표를 누르면 방금
 * 화면에 없던 컴포넌트로 튄다. 목록이 `sessionStorage` 에 남긴 **실제 브라우징 순서**를 쓴다.
 */
export function DetailHeader({
  entry,
  ctx,
  pinned,
  running,
}: {
  entry: Entry;
  ctx: PromptContext;
  pinned: boolean;
  running: boolean;
}) {
  const { prev, next } = useNeighbors(entry.name);

  // ←/→ 로도 넘긴다. 여러 개를 훑을 때 마우스를 화살표 버튼까지 옮기는 왕복이 사라진다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft" && prev) navigate(`/c/${prev}`);
      if (event.key === "ArrowRight" && next) navigate(`/c/${next}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <header className="mt-2">
      <div className="flex items-start justify-between gap-4">
        <nav aria-label="위치" className="flex items-center gap-1.5 text-step-n2 text-st-muted-foreground">
          <Link to="/" className="hover:text-st-foreground">
            컴포넌트
          </Link>
          <span aria-hidden>›</span>
          {/* 분류를 눌러 그 분류만 걸린 목록으로 — 비슷한 것을 이어서 볼 때의 지름길. */}
          <Link to={`/?cat=${entry.meta.category}`} className="hover:text-st-foreground">
            {entry.meta.category}
          </Link>
        </nav>

        {/*
          없는 방향도 자리를 지킨다(비활성). 하나만 있을 때 버튼이 사라지면 남은 버튼의 위치가
          옮겨져, 연달아 누르던 손이 헛돈다.
        */}
        <div className="flex shrink-0 items-center gap-1">
          <NeighborButton to={prev} direction="prev" />
          <NeighborButton to={next} direction="next" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-step-2 font-semibold">{entry.name}</h1>
            <CategoryBadge category={entry.meta.category} />
            <StatusBadge status={entry.meta.status} />
            {running ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-st-badge-success-bg px-2 py-0.5 text-step-n2 font-medium text-st-success">
                <span aria-hidden className="anim-status-pulse size-1.5 rounded-full bg-st-success" />
                고치는 중
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 max-w-2xl text-step-n1 text-st-muted-foreground">
            {entry.meta.summary}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip content={pinned ? "고정 해제" : "자주 쓰는 것으로 고정"}>
            <button
              type="button"
              aria-label={pinned ? "고정 해제" : "고정"}
              aria-pressed={pinned}
              onClick={() => togglePin(entry.name)}
              className={cn(
                "press inline-flex h-9 w-9 items-center justify-center rounded-full",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring",
                pinned ? "text-st-warning" : "text-st-muted-foreground hover:bg-st-button-ghost-hover-bg",
              )}
            >
              <StarIcon filled={pinned} />
            </button>
          </Tooltip>

          {/*
            프롬프트 3종은 '이 컴포넌트로 무엇을 시킬 것인가' 라는 같은 축의 변형이라 한 덩어리로
            묶고 아이콘으로 가른다. 툴팁에는 이름이 아니라 **용도**를 적는다.
            _근거: 상류 하네스 23f4ff6b0 · 5a5b5098b._
          */}
          <div className="flex items-center gap-0.5 rounded-full border border-st-border bg-st-card p-0.5">
            <CopyButton
              icon={<CopyIcon />}
              label="통합 프롬프트 복사"
              copiedLabel="복사됨"
              tooltip="다른 화면에 이 컴포넌트를 가져다 쓰라고 시킨다"
              text={buildIntegrationPrompt(entry, ctx)}
            />
            <CopyButton
              icon={<WandIcon />}
              label="수정 프롬프트 복사"
              copiedLabel="복사됨"
              tooltip="이 컴포넌트 자체를 고치라고 시킨다 (요청사항만 적으면 된다)"
              text={buildModifyPrompt(entry, ctx)}
            />
            <CopyButton
              icon={<SplitIcon />}
              label="분할 프롬프트 복사"
              copiedLabel="복사됨"
              tooltip="너무 커진 이 컴포넌트를 조각으로 쪼개 다시 조립하라고 시킨다"
              text={buildSplitPrompt(entry, ctx)}
            />
          </div>

          {/* 에이전트가 켜진 갤러리에서만 나타난다 — 꺼져 있으면 위 복사 버튼이 유일한 길이다. */}
          <DetailRunControl entry={entry} ctx={ctx} />

          <KebabMenu entry={entry} ctx={ctx} />
        </div>
      </div>
    </header>
  );
}

function NeighborButton({ to, direction }: { to: string | null; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "이전 컴포넌트 (←)" : "다음 컴포넌트 (→)";
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;

  if (!to) {
    return (
      <span aria-hidden className="grid size-8 place-items-center rounded-full opacity-25">
        <Icon width={15} height={15} />
      </span>
    );
  }

  return (
    <Tooltip content={label}>
      <Link
        to={`/c/${to}`}
        aria-label={label}
        className="press grid size-8 place-items-center rounded-full text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground"
      >
        <Icon width={15} height={15} />
      </Link>
    </Tooltip>
  );
}

/**
 * 자주 쓰지 않지만 없으면 아쉬운 것들.
 *
 * import 문과 링크 복사는 헤더에 버튼으로 세우면 이미 넷인 액션 줄이 여섯이 된다. 그렇다고
 * 없애면 import 문을 사이드바에서 손으로 긁어야 한다.
 */
function KebabMenu({ entry, ctx }: { entry: Entry; ctx: PromptContext }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const importLine = `import { ${componentNameOf(entry)} } from "${importPathFor(entry, ctx)}";`;

  return (
    <>
      <Tooltip content="더 보기">
        <button
          ref={anchorRef}
          type="button"
          aria-label="더 보기"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="press grid size-9 place-items-center rounded-full text-st-muted-foreground hover:bg-st-button-ghost-hover-bg hover:text-st-foreground"
        >
          <KebabIcon />
        </button>
      </Tooltip>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} label="더 보기">
        <div className="flex w-52 flex-col p-1">
          <CopyButton
            text={importLine}
            label="import 문 복사"
            variant="ghost"
            size="sm"
            className="justify-start"
          />
          <CopyButton
            text={`${ctx.baseUrl}/c/${entry.name}`}
            label="이 화면 링크 복사"
            variant="ghost"
            size="sm"
            className="justify-start"
          />
        </div>
      </Popover>
    </>
  );
}

/** 목록이 남긴 브라우징 순서 키. `LibraryResults` 가 같은 이름으로 쓴다. */
const ORDER_KEY = "ie:list-order";

function useNeighbors(name: string): { prev: string | null; next: string | null } {
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ORDER_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setOrder(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
      // 순서를 못 읽으면 화살표가 비활성일 뿐이다 — 상세 화면 자체는 떠야 한다.
    }
  }, []);

  const index = order.indexOf(name);
  if (index === -1) return { prev: null, next: null };
  return { prev: order[index - 1] ?? null, next: order[index + 1] ?? null };
}

/** 목록이 자기 순서를 남긴다. 상세의 ←/→ 가 **방금 보던 목록**을 따라가게 하는 유일한 연결점. */
export function rememberListOrder(names: string[]): void {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(names));
  } catch {
    /* 못 남겨도 목록은 뜬다 */
  }
}
