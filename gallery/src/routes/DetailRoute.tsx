import { useState } from "react";
import entries from "virtual:ie/entries";
import historyByName from "virtual:ie/history";
import galleryConfig from "virtual:ie/config";
import type { ElementStatus } from "instant-elements/registry";
import { CodeBlock } from "../components/CodeBlock";
import { CopyButton } from "../components/CopyButton";
import { DemoFrame } from "../components/DemoFrame";
import { SafePreview } from "../components/SafePreview";
import { useAgent } from "../lib/agent-store";
import { usePins } from "../lib/pins";
import { findRelated } from "../lib/search";
import { buildUsageExample, type PromptContext } from "../lib/prompt";
import { Link } from "../router";
import { DetailHeader } from "./DetailRoute.header";
import { DetailHistory } from "./DetailRoute.history";
import { DetailPropsPanel } from "./DetailRoute.props-panel";

/**
 * 컴포넌트 상세.
 *
 * ── 섹션 순서를 바꿨다
 * 히스토리가 맨 아래였다. 이 도구에서 상세를 여는 가장 흔한 이유가 "이거 언제 뭐가 바뀌었지"인데,
 * 그 답을 보려면 스크롤을 끝까지 내려야 했다. 좌측 컬럼 맨 위로 올렸다.
 *
 * 사용 예제는 2컬럼 **바깥 아래**로 내리고 한 줄로 눌렀다 — 코드 한 줄이 세로 공간을 크게
 * 먹으면서 정작 자주 보는 값은 아니다. 관련 컴포넌트가 맨 끝이라 "다음에 볼 것"으로 이어진다.
 */
export function DetailRoute({ name }: { name: string }) {
  const pins = usePins();
  const { runningFor } = useAgent();
  const entry = entries.find((e) => e.name === name);

  /*
   * 상태는 서버에서 바뀌지만 `entries` 는 **빌드 타임에 굳은 값**이라 그대로다. 바꾼 직후의
   * 화면이 옛 상태를 보여 주지 않도록 로컬로 덮어쓴다(새로고침하면 서버 값과 만난다).
   */
  const [statusOverride, setStatusOverride] = useState<ElementStatus | null>(null);

  if (!entry) return <NotFound name={name} />;

  const view = statusOverride
    ? { ...entry, meta: { ...entry.meta, status: statusOverride } }
    : entry;

  const running = runningFor(`/c/${entry.name}`) !== null;
  const pinned = pins.includes(entry.name);

  // 쓰이는 곳 — composedOf 의 역방향. 이 하네스의 목적이 재사용이라, "이게 어디서 쓰이나"를
  // 못 보면 고쳐도 되는지 판단할 수 없다(고치면 무엇이 함께 흔들리는지 모른다).
  const usedBy = entries.filter((e) => e.meta.composedOf?.includes(entry.name));
  // 상세가 막다른 길이 되지 않게 — 여기서 옆으로 새는 길을 열어 준다.
  const related = findRelated(entries, entry);

  const ctx: PromptContext = {
    importAlias: galleryConfig.importAlias,
    baseUrl: `http://${galleryConfig.host}:${galleryConfig.port}`,
  };
  const history = historyByName[entry.name] ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <DetailHeader entry={view} ctx={ctx} pinned={pinned} running={running} />

      {/*
        `previewZoom` — 기본은 1(실제 크기)이다. 아주 작은 컴포넌트(뱃지·아이콘)는 프레임 안에서
        점처럼 보여 판단이 안 되므로 엔트리에서 키울 수 있게 열어 둔다.
        `w-full` 래퍼가 필요한 이유: zoom 안에서 폭을 안 잡아 주면 내용에 맞춰 줄어들어(shrink-to-fit)
        가운데 정렬이 무너진다.
      */}
      <DemoFrame className="mt-6 min-h-80">
        <div
          className="flex w-full items-center justify-center"
          style={{ zoom: entry.meta.previewZoom ?? 1 }}
        >
          <SafePreview name={entry.name} />
        </div>
      </DemoFrame>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DetailHistory name={entry.name} events={history} running={running} />
        <DetailPropsPanel
          entry={view}
          ctx={ctx}
          usedBy={usedBy}
          running={running}
          onStatusChanged={setStatusOverride}
        />
      </div>

      {/* 한 줄로 눌렀다 — 제목·코드·복사 버튼이 같은 줄에 서면 세로 공간을 거의 안 먹는다. */}
      <section className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-st-border bg-st-card px-4 py-3">
        <h2 className="shrink-0 text-step-n1 font-medium">사용 예제</h2>
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-step-n2 text-st-muted-foreground">
          {buildUsageExample(entry, ctx)}
        </code>
        <CopyButton text={buildUsageExample(entry, ctx)} label="복사" size="sm" />
      </section>

      {related.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-step-n1 font-medium text-st-muted-foreground">관련 컴포넌트</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {related.map((item) => (
              <Link
                key={item.name}
                to={`/c/${item.name}`}
                className="press inline-flex h-8 items-center gap-1.5 rounded-full border border-st-border bg-st-card px-3 text-step-n2 hover:border-st-ring"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-st-muted-foreground">{item.meta.category}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function NotFound({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-center">
      <p className="text-step-1 font-medium">컴포넌트를 찾을 수 없습니다.</p>
      <CodeBlock className="mx-auto mt-4 w-fit" code={name} copyable={false} />
      <Link
        to="/"
        className="press mt-6 inline-block text-step-n1 text-st-muted-foreground hover:text-st-foreground"
      >
        ← 라이브러리로
      </Link>
    </div>
  );
}
