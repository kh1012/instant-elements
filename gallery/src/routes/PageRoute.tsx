import { useCallback, useEffect, useState } from "react";
import galleryConfig from "virtual:ie/config";
import { resolveFrame, type FrameId, type PageNode } from "instant-elements/page";
import { Button } from "../components/Button";
import {
  addFeedback,
  clearFeedback,
  deleteFeedback,
  fetchFeedback,
  fetchPage,
  type FeedbackItem,
} from "../lib/api";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { FeedbackPanel } from "../page/FeedbackPanel";
import { FrameToggle, PageFrame, ZoomControl } from "../page/PageFrame";
import { renderNodes } from "../page/PageRender";
import { PageSketch, type SketchMode } from "../page/PageSketch";
import { Link } from "../router";

type ViewMode = SketchMode | "live";

const MODE_LABEL: Record<ViewMode, string> = {
  minimal: "최소",
  summary: "요약",
  live: "라이브",
};

/**
 * 페이지 플레이그라운드.
 *
 * 조작이 아니라 **확인하고 지목하는** 표면이다 — 드래그로 배치하는 편집기는 두지 않는다.
 * 조립은 말로 설명하고(에이전트), 여기서는 결과를 보고 고칠 자리를 짚는다.
 */
export function PageRoute({ slug }: { slug: string }) {
  const state = useAsync(() => fetchPage(slug), [slug]);
  const [mode, setMode] = useState<ViewMode>("live");
  const [frameOverride, setFrameOverride] = useState<FrameId | null>(null);
  const [zoom, setZoom] = useState(1);
  const [target, setTarget] = useState<PageNode | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    let alive = true;
    void fetchFeedback(slug)
      .then((result) => {
        if (alive) setFeedback(result.items);
      })
      .catch(() => {
        if (alive) setFeedback([]);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const submit = useCallback(
    async ({ comment, components }: { comment: string; components: string[] }) => {
      const result = await addFeedback(slug, {
        comment,
        ...(target?.props.id ? { nodeId: target.props.id, nodeType: target.type } : {}),
        ...(components.length > 0 ? { components } : {}),
      });
      setFeedback(result.items);
    },
    [slug, target],
  );

  const remove = useCallback(
    async (id: string) => {
      setFeedback((await deleteFeedback(slug, id)).items);
    },
    [slug],
  );

  const clearAll = useCallback(async () => {
    setFeedback((await clearFeedback(slug)).items);
  }, [slug]);

  if (state.status === "loading") return <Centered>불러오는 중…</Centered>;
  if (state.status === "error") {
    return (
      <Centered>
        <p className="text-step-0 font-medium">페이지를 찾을 수 없습니다</p>
        <p className="mt-2 text-step-n1 text-st-muted-foreground">
          <code>{slug}</code> — {state.error}
        </p>
        <Link
          to="/pages"
          className="press mt-6 inline-block rounded-md bg-st-primary px-3 py-1.5 text-step-n1 text-st-primary-foreground"
        >
          페이지 목록으로
        </Link>
      </Centered>
    );
  }

  const page = state.value;
  // 툴바의 프레임 전환은 저장하지 않는다 — 진실은 페이지 데이터(root.props.pageSize)다.
  const frame = resolveFrame(page.data.root.props["pageSize"], frameOverride);
  // 패널 순서와 같은 번호를 붙인다 — "3번 피드백이 저 자리"가 눈으로 이어져야 한다.
  const markers = new Map<string, number>();
  feedback.forEach((item, index) => {
    if (item.nodeId && !markers.has(item.nodeId)) markers.set(item.nodeId, index + 1);
  });

  const renderOptions = {
    onNodeClick: setTarget,
    activeId: target?.props.id ?? null,
    markers,
  };

  return (
    <div className="mx-auto max-w-[min(100%,1800px)] px-6 py-8">
      <Link to="/pages" className="press text-step-n1 text-st-muted-foreground hover:text-st-foreground">
        ← 페이지
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-step-2 font-semibold">{page.title || page.slug}</h1>
          <p className="mt-1 text-step-n2 text-st-muted-foreground">
            v{page.version} · {page.updatedBy || "알 수 없음"}
            {page.updatedAt ? ` · ${relativeTime(page.updatedAt)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md bg-st-muted p-0.5">
            {(["minimal", "summary", "live"] as ViewMode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "press rounded-sm px-2.5 py-1 text-step-n2",
                  mode === value
                    ? "bg-st-card text-st-foreground shadow-sm"
                    : "text-st-muted-foreground hover:text-st-foreground",
                )}
              >
                {MODE_LABEL[value]}
              </button>
            ))}
          </div>
          {mode === "live" ? (
            <>
              <FrameToggle value={frame.id} onChange={setFrameOverride} />
              <ZoomControl value={zoom} onChange={setZoom} />
            </>
          ) : null}
          <Button size="sm" onClick={state.reload}>
            새로고침
          </Button>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-6 xl:flex-row">
        <div className="min-w-0 flex-1">
          {page.data.content.length === 0 ? (
            <div className="rounded-lg border border-dashed border-st-border p-12 text-center">
              <p className="text-step-0 font-medium">아직 비어 있습니다.</p>
              <p className="mt-2 text-step-n1 text-st-muted-foreground">
                에이전트에게 이 페이지에 무엇을 놓을지 설명해 보세요.
              </p>
            </div>
          ) : mode === "live" ? (
            <PageFrame frame={frame.id} zoom={zoom}>
              {renderNodes(page.data.content, "column", renderOptions, true)}
            </PageFrame>
          ) : (
            <div className="rounded-lg border border-st-border bg-st-card p-4">
              <PageSketch
                nodes={page.data.content}
                mode={mode}
                onNodeClick={setTarget}
                activeId={target?.props.id ?? null}
                markers={markers}
              />
            </div>
          )}
        </div>

        <FeedbackPanel
          page={page}
          items={feedback}
          target={target}
          importAlias={galleryConfig.importAlias}
          onSubmit={submit}
          onDelete={remove}
          onClearAll={clearAll}
          onClearTarget={() => setTarget(null)}
        />
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-6 py-20 text-center">{children}</div>;
}
