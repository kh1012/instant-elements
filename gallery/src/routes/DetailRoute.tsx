import entries from "virtual:ie/entries";
import historyByName from "virtual:ie/history";
import galleryConfig from "virtual:ie/config";
import type { Entry, HistoryEvent } from "instant-elements/registry";
import { CodeBlock } from "../components/CodeBlock";
import { CopyButton } from "../components/CopyButton";
import { DemoFrame } from "../components/DemoFrame";
import { SafePreview } from "../components/SafePreview";
import { CategoryBadge, StatusBadge } from "../components/StatusBadge";
import { formatAt, relativeTime } from "../lib/format";
import { CopyIcon, SplitIcon, StarIcon, WandIcon } from "../components/icons";
import { Tooltip } from "../components/Tooltip";
import { togglePin, usePins } from "../lib/pins";
import { cn } from "../lib/cn";
import {
  buildIntegrationPrompt,
  buildModifyPrompt,
  buildSplitPrompt,
  buildUsageExample,
  componentNameOf,
  importPathFor,
  type PromptContext,
} from "../lib/prompt";
import { Link } from "../router";

const ACTION_LABEL: Record<HistoryEvent["action"], string> = {
  created: "생성",
  modified: "수정",
  recommended: "재사용 추천",
};

export function DetailRoute({ name }: { name: string }) {
  const pins = usePins();
  const entry = entries.find((e) => e.name === name);
  if (!entry) return <NotFound name={name} />;
  const pinned = pins.includes(entry.name);

  const ctx: PromptContext = {
    importAlias: galleryConfig.importAlias,
    baseUrl: `http://${galleryConfig.host}:${galleryConfig.port}`,
  };
  const history = historyByName[entry.name] ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        to="/"
        className="press text-step-n1 text-st-muted-foreground hover:text-st-foreground"
      >
        ← 라이브러리
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-step-2 font-semibold">{entry.name}</h1>
            <CategoryBadge category={entry.meta.category} />
            <StatusBadge status={entry.meta.status} />
          </div>
          <p className="mt-1.5 max-w-2xl text-step-n1 text-st-muted-foreground">
            {entry.meta.summary}
          </p>
        </div>

        {/*
          프롬프트 3종은 '이 컴포넌트로 무엇을 시킬 것인가' 라는 같은 축의 변형이라 한 덩어리로
          묶고 아이콘으로 가른다. 라벨 3개를 늘어놓으면 줄을 다 먹고, 케밥에 넣으면 묻힌다.
          툴팁에는 이름이 아니라 **용도**를 적는다 — 이름만으로는 무엇이 다른지 여전히 모른다.
          _근거: 상류 하네스 23f4ff6b0 · 5a5b5098b._
        */}
        <div className="flex items-center gap-2">
          <Tooltip content={pinned ? "고정 해제" : "자주 쓰는 것으로 고정"}>
            <button
              type="button"
              aria-label={pinned ? "고정 해제" : "고정"}
              aria-pressed={pinned}
              onClick={() => togglePin(entry.name)}
              className={cn(
                "press inline-flex h-9 w-9 items-center justify-center rounded-md",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring",
                pinned
                  ? "text-st-warning"
                  : "text-st-muted-foreground hover:bg-st-button-ghost-hover-bg",
              )}
            >
              <StarIcon filled={pinned} />
            </button>
          </Tooltip>

          <div className="flex items-center gap-0.5 rounded-md border border-st-border bg-st-card p-0.5">
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
        </div>
      </header>

      <DemoFrame className="mt-6">
        <SafePreview name={entry.name} />
      </DemoFrame>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-step-0 font-semibold">사용 예제</h2>
            <CodeBlock className="mt-2" code={buildUsageExample(entry, ctx)} />
          </section>

          <section>
            <h2 className="text-step-0 font-semibold">
              히스토리 <span className="text-st-muted-foreground">{history.length}건</span>
            </h2>
            {history.length === 0 ? (
              <p className="mt-2 text-step-n1 text-st-muted-foreground">
                아직 기록이 없습니다.
              </p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {history.map((event, index) => (
                  <Timeline key={`${event.at}-${index}`} event={event} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-3 rounded-lg border border-st-border bg-st-card p-4">
          <Meta label="import">
            <code className="break-all text-step-n2">{importPathFor(entry, ctx)}</code>
          </Meta>
          <Meta label="export">
            <code className="text-step-n2">{componentNameOf(entry)}</code>
          </Meta>
          <Meta label="코드">
            <code className="break-all text-step-n2">{entry.files[0]?.path ?? "-"}</code>
          </Meta>
          <Meta label="역할">{entry.meta.intent}</Meta>
          <PropsMeta entry={entry} />
          {entry.meta.composedOf?.length ? (
            <Meta label="구성">
              <span className="flex flex-wrap gap-1.5">
                {entry.meta.composedOf.map((child) => (
                  <Link
                    key={child}
                    to={`/c/${child}`}
                    className="press rounded-sm bg-st-muted px-1.5 py-0.5 text-step-n2 hover:bg-st-interactive-muted-hover-bg"
                  >
                    {child}
                  </Link>
                ))}
              </span>
            </Meta>
          ) : null}
          {entry.meta.tokens?.length ? (
            <Meta label="토큰">
              <span className="text-step-n2">{entry.meta.tokens.join(", ")}</span>
            </Meta>
          ) : null}
          <Meta label="검색어">
            <span className="text-step-n2">{entry.meta.keywords.join(", ")}</span>
          </Meta>
          <Meta label="만든이">
            {entry.meta.createdBy} · {formatAt(entry.meta.createdAt)}
          </Meta>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-st-border pb-3 last:border-b-0 last:pb-0">
      <span className="text-step-n2 text-st-muted-foreground">{label}</span>
      <span className="text-step-n1 break-words">{children}</span>
    </div>
  );
}

function PropsMeta({ entry }: { entry: Entry }) {
  const props = entry.meta.props?.filter((p) => p.editable !== false) ?? [];
  if (props.length === 0) return null;
  return (
    <Meta label="props">
      <span className="flex flex-col gap-0.5">
        {props.map((prop) => (
          <code key={prop.name} className="text-step-n2">
            {prop.name}
            <span className="text-st-muted-foreground">
              :{prop.type}
              {prop.type === "enum" && prop.options?.length ? `(${prop.options.join("/")})` : ""}
            </span>
          </code>
        ))}
      </span>
    </Meta>
  );
}

function Timeline({ event }: { event: HistoryEvent }) {
  return (
    <li className="rounded-lg border border-st-border bg-st-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-step-n2">
        <span className="font-medium">{ACTION_LABEL[event.action]}</span>
        <span className="text-st-muted-foreground">{event.actor}</span>
        <span className="text-st-muted-foreground">{relativeTime(event.at)}</span>
        {event.sha ? (
          <code className="rounded-sm bg-st-muted px-1.5 py-0.5">{event.sha.slice(0, 7)}</code>
        ) : null}
      </div>
      {event.note ? <p className="mt-1.5 text-step-n1">{event.note}</p> : null}
      {event.prompt ? (
        <blockquote className="mt-2 border-l-2 border-st-border pl-3 text-step-n2 whitespace-pre-wrap text-st-muted-foreground">
          {event.prompt}
        </blockquote>
      ) : null}
    </li>
  );
}

function NotFound({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center">
      <p className="text-step-1 font-semibold">컴포넌트를 찾을 수 없습니다</p>
      <p className="mt-2 text-step-n1 text-st-muted-foreground">
        <code>{name}</code> 은 이 프로젝트 레지스트리에 없습니다.
      </p>
      <Link
        to="/"
        className="press mt-6 inline-block rounded-md bg-st-primary px-3 py-1.5 text-step-n1 text-st-primary-foreground"
      >
        라이브러리로
      </Link>
    </div>
  );
}
