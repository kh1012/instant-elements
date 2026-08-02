import type { PageHistoryEvent } from "instant-elements/page";
import { Avatar } from "../components/Avatar";
import { Timeline, TimelineBody, TimelineItem, TimelineMeta } from "../components/Timeline";
import { formatAt } from "../lib/format";
import { avatarUrlFor, useIdentity } from "../lib/identity";

const ACTION_LABEL: Record<PageHistoryEvent["action"], string> = {
  created: "생성",
  edited: "수정",
  refined: "다듬음",
  restored: "복원",
};

const ACTION_TONE: Record<PageHistoryEvent["action"], "primary" | "muted" | "success"> = {
  created: "primary",
  edited: "muted",
  refined: "muted",
  restored: "success",
};

/**
 * 페이지 편집 이력.
 *
 * 스키마가 컴포넌트 이력과 다르다 — 여기엔 `sha` 가 없고 대신 `version` 이 있다(페이지는 git
 * 커밋이 아니라 버전 스냅샷으로 되돌린다). 그래서 이벤트 렌더는 따로지만 **레일·간격은 공용
 * `Timeline` 뼈대**를 쓴다. 같은 도구 안에서 두 이력이 다른 리듬으로 서면 바로 눈에 띈다.
 */
export function PageHistory({ events }: { events: PageHistoryEvent[] }) {
  const { identity } = useIdentity();

  if (events.length === 0) {
    return <p className="text-step-n2 text-st-muted-foreground">아직 기록이 없습니다.</p>;
  }

  // 최신이 위. 서버는 오래된 순으로 준다.
  const ordered = [...events].reverse();

  return (
    <Timeline>
      {ordered.map((event, index) => (
        <TimelineItem
          key={`${event.at}-${index}`}
          tone={ACTION_TONE[event.action]}
          last={index === ordered.length - 1}
          index={index}
        >
          <TimelineMeta>
            <span className="font-medium">{ACTION_LABEL[event.action]}</span>
            <code className="font-mono text-st-muted-foreground">v{event.version}</code>
            <span className="flex items-center gap-1.5 text-st-muted-foreground">
              <Avatar name={event.actor} src={avatarUrlFor(event.actor, identity)} size="xs" />
              {event.actor}
            </span>
            <time dateTime={event.at} className="text-st-muted-foreground">
              {formatAt(event.at)}
            </time>
          </TimelineMeta>
          {event.note ? <TimelineBody>{event.note}</TimelineBody> : null}
        </TimelineItem>
      ))}
    </Timeline>
  );
}
