import { useCallback, useMemo, useState } from "react";
import { resolveFrame, type PageData } from "instant-elements/page";
import { Button } from "../components/Button";
import { FlowMap } from "../components/FlowMap";
import { cn } from "../lib/cn";
import { useAsync } from "../lib/useAsync";
import { PageFrame } from "../page/PageFrame";
import { renderNodes } from "../page/PageRender";
import { Link } from "../router";

interface FlowEdge {
  id: string;
  from: { slug: string; nodeId: string; action?: string; value?: string };
  to: string;
}

interface FlowScreen {
  slug: string;
  version: string;
  title: string;
  data: PageData | null;
  /** 편입 시점 스냅샷이 없어 최신본으로 대체했다 — 시연이 흔들릴 수 있다. */
  stale: boolean;
}

interface FlowDetail {
  slug: string;
  flow: { name: string; start?: string; frame?: string; edges: FlowEdge[] };
  screens: FlowScreen[];
}

/**
 * 흐름 시연.
 *
 * 화면을 실제로 그리고, **연결된 자리를 누르면 다음 화면으로 넘어간다.** 눌릴 수 있는 자리는
 * 페이지 저작이 정한다 — 노드 통짜이거나, 컴포넌트가 선언한 `type:"action"` 콜백이다.
 *
 * 지도 모드는 어떤 화면이 어디로 이어지는지 한눈에 보여 준다. 시연 중에는 그 그림이 머리에
 * 있어야 "지금 어디에 있는지" 를 잃지 않는다.
 */
export function FlowRoute({ slug }: { slug: string }) {
  const state = useAsync(
    () =>
      fetch(`/api/flows/${encodeURIComponent(slug)}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FlowDetail>;
      }),
    [slug],
  );
  const [current, setCurrent] = useState<string | null>(null);
  const [mode, setMode] = useState<"play" | "map">("play");
  const [hint, setHint] = useState(false);

  const detail = state.status === "ready" ? state.value : null;
  const active = current ?? detail?.flow.start ?? detail?.screens[0]?.slug ?? null;
  const screen = detail?.screens.find((s) => s.slug === active) ?? null;

  /** 이 화면에서 눌릴 수 있는 자리 → 목적지. */
  const exits = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of detail?.flow.edges ?? []) {
      if (edge.from.slug === active) map.set(edge.from.nodeId, edge.to);
    }
    return map;
  }, [detail, active]);

  const go = useCallback(
    (nodeId: string) => {
      const to = exits.get(nodeId);
      if (to) setCurrent(to);
    },
    [exits],
  );

  if (state.status === "loading") return <Centered>불러오는 중…</Centered>;
  if (state.status === "error" || !detail) {
    return (
      <Centered>
        <p className="text-step-0 font-medium">흐름을 찾을 수 없습니다</p>
        <Link
          to="/flows"
          className="press mt-6 inline-block rounded-md bg-st-primary px-3 py-1.5 text-step-n1 text-st-primary-foreground"
        >
          흐름 목록으로
        </Link>
      </Centered>
    );
  }

  const frame = resolveFrame(screen?.data?.root.props["pageSize"], detail.flow.frame);

  return (
    <div className="mx-auto max-w-[min(100%,1800px)] px-6 py-8">
      <Link to="/flows" className="press text-step-n1 text-st-muted-foreground hover:text-st-foreground">
        ← 흐름
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-step-2 font-semibold">{detail.flow.name}</h1>
          <p className="mt-1 text-step-n2 text-st-muted-foreground">
            화면 {detail.screens.length}개 · 연결 {detail.flow.edges.length}개
            {screen ? ` · 지금 ${screen.title}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md bg-st-muted p-0.5">
            {(["play", "map"] as const).map((value) => (
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
                {value === "play" ? "재생" : "지도"}
              </button>
            ))}
          </div>
          {mode === "play" ? (
            <>
              <Button size="sm" onClick={() => setHint((v) => !v)}>
                {hint ? "핫스팟 숨기기" : "핫스팟 보기"}
              </Button>
              <Button
                size="sm"
                onClick={() => setCurrent(detail.flow.start ?? detail.screens[0]?.slug ?? null)}
              >
                처음부터
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {mode === "map" ? (
        <div className="mt-6">
          <FlowMap
            screens={detail.screens}
            edges={detail.flow.edges}
            start={detail.flow.start}
            active={active}
            onPick={setCurrent}
            staleSlugs={new Set(detail.screens.filter((s) => s.stale).map((s) => s.slug))}
          />
        </div>
      ) : !screen?.data ? (
        <Centered>이 화면의 내용을 불러오지 못했습니다.</Centered>
      ) : (
        <div className="mt-6">
          {screen.stale ? (
            <p className="mb-2 text-step-n2 text-st-warning">
              편입 시점 스냅샷이 없어 최신본으로 그립니다 — 시연 내용이 달라질 수 있습니다.
            </p>
          ) : null}
          <PageFrame frame={frame.id}>
            {renderNodes(
              screen.data.content,
              "column",
              {
                onNodeClick: (node) => {
                  if (node.props.id) go(node.props.id);
                },
                activeId: null,
                // 연결된 자리를 표시한다 — 시연 중 "어디를 누르면 되나"를 물어보지 않아도 되게.
                // 번호는 순서 의미가 없으므로 모두 같은 값을 준다(존재 자체가 신호다).
                markers: hint ? new Map([...exits.keys()].map((id) => [id, 0])) : new Map(),
              },
              true,
            )}
          </PageFrame>
        </div>
      )}
    </div>
  );
}


function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-6 py-20 text-center">{children}</div>;
}
