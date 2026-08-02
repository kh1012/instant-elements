import { memo } from "react";
import galleryConfig from "virtual:ie/config";
import type { Entry } from "instant-elements/registry";
import { cn } from "../lib/cn";
import { togglePin } from "../lib/pins";
import { buildIntegrationPrompt } from "../lib/prompt";
import { isNew } from "../lib/search";
import { Link } from "../router";
import { Avatar } from "./Avatar";
import { CopyButton } from "./CopyButton";
import { Highlight } from "./Highlight";
import { CategoryBadge, StatusBadge } from "./StatusBadge";
import { PinIcon } from "./icons";
import { Tooltip } from "./Tooltip";

/**
 * 목록 뷰의 한 줄.
 *
 * 그리드는 "어떻게 생겼나"를 묻는 화면이고, 목록은 **"뭐가 있나"를 훑는 화면**이다. 그래서
 * 프리뷰를 아예 그리지 않는다 — 줄마다 썸네일을 넣으면 그리드보다 조금 좁을 뿐 스캔 속도는
 * 그대로다. 대신 한 줄에 이름·설명·분류·작성자·상태를 모두 세워 눈이 세로로만 움직이게 한다.
 */
function ComponentRowImpl({
  entry,
  pinned = false,
  query = "",
  running = false,
  compact = false,
}: {
  entry: Entry;
  pinned?: boolean;
  query?: string;
  running?: boolean;
  compact?: boolean;
}) {
  const fresh = isNew(entry);
  const prompt = buildIntegrationPrompt(entry, {
    importAlias: galleryConfig.importAlias,
    baseUrl: `http://${galleryConfig.host}:${galleryConfig.port}`,
  });

  return (
    <div
      className={cn(
        "group relative isolate flex items-center gap-3 border-b border-st-border px-3",
        compact ? "py-2" : "py-3",
        "hover:bg-st-muted/40",
        running ? "ring-1 ring-inset ring-st-success" : "",
      )}
    >
      <Link
        to={`/c/${entry.name}`}
        className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-st-ring"
      >
        <span className="sr-only">{entry.name} 상세 보기</span>
      </Link>

      <span
        className="relative z-10 shrink-0"
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
              "press grid size-6 place-items-center rounded-full",
              pinned
                ? "text-st-primary opacity-100"
                : "text-st-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            <PinIcon filled={pinned} width={13} height={13} />
          </button>
        </Tooltip>
      </span>

      <span className="min-w-0 shrink-0 basis-52 truncate text-step-n1 font-medium">
        <Highlight text={entry.name} query={query} />
        {fresh ? <span className="ml-1.5 text-step-n2 text-st-destructive">N</span> : null}
      </span>

      <span className="min-w-0 flex-1 truncate text-step-n2 text-st-muted-foreground">
        <Highlight text={entry.meta.summary || entry.meta.intent} query={query} />
      </span>

      <CategoryBadge category={entry.meta.category} className="shrink-0" />

      <Tooltip content={`만든이 ${entry.meta.createdBy}`}>
        <span className="shrink-0">
          <Avatar name={entry.meta.createdBy} size="xs" />
        </span>
      </Tooltip>

      <span className="w-24 shrink-0 text-right">
        <StatusBadge status={entry.meta.status} />
      </span>

      <span className="relative z-10 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <CopyButton text={prompt} label="프롬프트 복사" size="sm" />
      </span>
    </div>
  );
}

export const ComponentRow = memo(ComponentRowImpl);
