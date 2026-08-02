import type { HistoryEvent } from "instant-elements/registry";
import { Avatar, AvatarGroup } from "../components/Avatar";
import { RichText, hasCodeFence } from "../components/RichText";
import { Timeline, TimelineBody, TimelineItem, TimelineMeta } from "../components/Timeline";
import { formatAt, relativeTime } from "../lib/format";
import { avatarUrlFor } from "../lib/identity";
import { useIdentity } from "../lib/identity";
import { Tooltip } from "../components/Tooltip";
import { RestoreControl } from "./DetailRoute.restore-control";

const ACTION_LABEL: Record<HistoryEvent["action"], string> = {
  created: "생성",
  modified: "수정",
  recommended: "추천",
};

const ACTION_TONE: Record<HistoryEvent["action"], "primary" | "muted"> = {
  created: "primary",
  modified: "muted",
  recommended: "muted",
};

/**
 * 히스토리.
 *
 * 화면 좌측 컬럼 **맨 위**에 둔다. 예전에는 맨 아래였는데, 이 도구에서 상세를 여는 가장 흔한
 * 이유가 "이거 언제 뭐가 바뀌었지"라 스크롤을 끝까지 내려야 답이 나왔다.
 *
 * 시각은 절대(`2026.08.02 14:30`)로 적고 상대시간은 곁들인다. "3시간 전"만 있으면 두 사건
 * 사이의 간격을 알 수 없고, 어제 본 화면과 오늘 본 화면을 맞춰 볼 수도 없다.
 */
export function DetailHistory({
  name,
  events,
  running,
}: {
  name: string;
  /** 최신이 위. */
  events: HistoryEvent[];
  running: boolean;
}) {
  const { identity } = useIdentity();

  /*
   * 복원은 **마지막 생성 이후**의 시점만 허용한다. 그 이전으로 되돌리면 컴포넌트가 존재하지
   * 않던 시점이라 파일이 통째로 사라진다(서버도 막지만, 누를 수 있는 버튼을 두지 않는 게 낫다).
   */
  const createdIndex = events.findIndex((event) => event.action === "created");
  const restorableUntil = createdIndex === -1 ? events.length : createdIndex;

  // 기여자는 중복을 걷어 낸다. 같은 사람이 열 번 고쳤어도 헤더에는 한 번만 나와야 한다.
  const contributors = [...new Set(events.map((event) => event.actor))].map((actor) => ({
    name: actor,
    src: avatarUrlFor(actor, identity),
  }));

  if (events.length === 0) {
    return (
      <section>
        <h2 className="text-step-0 font-medium">히스토리</h2>
        <p className="mt-2 text-step-n2 text-st-muted-foreground">아직 기록이 없습니다.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-step-0 font-medium">
          히스토리 <span className="text-step-n2 text-st-muted-foreground">{events.length}건</span>
        </h2>
        {contributors.length > 1 ? <AvatarGroup people={contributors} max={4} /> : null}
      </div>

      <Timeline>
        {events.map((event, index) => {
          const prompt = event.prompt?.trim();
          return (
            <TimelineItem
              key={`${event.at}-${index}`}
              tone={ACTION_TONE[event.action]}
              last={index === events.length - 1}
              index={index}
            >
              <TimelineMeta>
                <span className="font-medium">{ACTION_LABEL[event.action]}</span>
                <span className="flex items-center gap-1.5 text-st-muted-foreground">
                  <Avatar name={event.actor} src={avatarUrlFor(event.actor, identity)} size="xs" />
                  {event.actor}
                </span>
                <Tooltip content={relativeTime(event.at)}>
                  <time dateTime={event.at} className="text-st-muted-foreground">
                    {formatAt(event.at)}
                  </time>
                </Tooltip>
                {event.sha ? (
                  <code className="rounded bg-st-muted px-1.5 py-0.5 font-mono text-step-n2 text-st-muted-foreground">
                    {event.sha.slice(0, 7)}
                  </code>
                ) : null}
              </TimelineMeta>

              {event.note ? <TimelineBody>{event.note}</TimelineBody> : null}

              {prompt ? (
                <TimelineBody>
                  {/*
                    코드 펜스가 있으면 인용부호를 씌우지 않는다 — 따옴표 안에 코드블록이 들어가면
                    어디까지가 인용인지 오히려 흐려진다.
                  */}
                  {hasCodeFence(prompt) ? (
                    <RichText text={prompt} />
                  ) : (
                    <blockquote className="border-l-2 border-st-border pl-3 italic">
                      <RichText text={prompt} />
                    </blockquote>
                  )}
                </TimelineBody>
              ) : null}

              {event.sha && index < restorableUntil ? (
                <RestoreControl name={name} sha={event.sha} running={running} />
              ) : null}
            </TimelineItem>
          );
        })}
      </Timeline>
    </section>
  );
}
