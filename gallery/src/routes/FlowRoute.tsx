import { useCallback, useMemo, useState } from "react";
import { resolveFrame, type PageData } from "instant-elements/page";
import { Button } from "../components/Button";
import { FlowMap } from "../components/FlowMap";
import { FlowSettings } from "./FlowRoute.settings";
import { linkFlowHotspot, retargetFlowEdge } from "../lib/api";
import { cn } from "../lib/cn";
import { useAsync } from "../lib/useAsync";
import { PageFrame } from "../page/PageFrame";
import { renderNodes } from "../page/PageRender";
import { Link } from "../router";
import { FlowEmptyScreens } from "./FlowRoute.screens";

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
  const [notice, setNotice] = useState<string | null>(null);
  const [pickedEdge, setPickedEdge] = useState<string | null>(null);
  /** 배선 모드 — 켜면 노드를 눌러도 넘어가지 않고 "여기서 어디로 갈까"를 묻는다. */
  const [wiring, setWiring] = useState(false);
  const [wiringNode, setWiringNode] = useState<string | null>(null);
  const [mode, setMode] = useState<"play" | "map">("play");
  const [hint, setHint] = useState(false);

  const detail = state.status === "ready" ? state.value : null;

  /*
   * 렌더 밖에서 계산한다. JSX 안에서 만들면 매 렌더 새 배열이 되고, 그게 지도의 노드 메모를
   * 무효화해 xyflow 가 노드를 재등록한다 — 그 사이 연결선이 사라지는 일이 실제로 있었다.
   */
  const staleSlugs = useMemo(
    () => detail?.screens.filter((s) => s.stale).map((s) => s.slug) ?? [],
    [detail],
  );
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

          {/*
            설정을 헤더 안에 둔다 — 시연 직전에 "시작을 이 화면으로"가 나오는 자리가 여기다.
            별도 화면으로 빼면 그 왕복이 시연 흐름을 끊는다.
          */}
          <div className="mt-2">
            <FlowSettings
              slug={slug}
              screens={detail.screens.map((s) => ({ slug: s.slug, title: s.title }))}
              start={detail.flow.start}
              frame={detail.flow.frame}
              onChanged={state.reload}
            />
          </div>
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
              {/*
                배선 모드에서는 누르는 뜻이 "넘어가기" → "여기를 눌렀을 때 어디로 갈지 정하기"로
                바뀐다. 같은 화면에서 두 뜻이 섞이면 시연 중 실수로 배선을 고치게 된다.
              */}
              <Button
                size="sm"
                variant={wiring ? "primary" : "outline"}
                onClick={() => {
                  setWiring((v) => !v);
                  setWiringNode(null);
                }}
              >
                {wiring ? "배선 끝내기" : "배선하기"}
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
          {notice ? (
            <p className="mb-2 flex items-center gap-2 text-step-n2 text-st-muted-foreground">
              {notice}
              <button type="button" onClick={() => setNotice(null)} className="underline">
                닫기
              </button>
            </p>
          ) : null}
          <FlowMap
            screens={detail.screens}
            edges={detail.flow.edges}
            start={detail.flow.start}
            active={active}
            onPick={setCurrent}
            staleSlugs={staleSlugs}
            onRetarget={(id, to) => {
              // 낙관적 갱신을 하지 않는다 — 서버가 거부하면(편입 안 된 화면 등) 화면과 파일이
              // 갈라진다. 다시 읽는 편이 한 박자 느려도 항상 맞다.
              void retargetFlowEdge(slug, id, to).then(state.reload);
            }}
            onEdgeSelect={setPickedEdge}
            onConnectAttempt={() =>
              setNotice(
                "지도에서는 목적지만 바꿀 수 있습니다. 새 연결은 화면에서 어느 요소를 누를지 정해야 하므로 `ie flow link` 로 만듭니다.",
              )
            }
          />

          {/*
            고른 연결의 목적지를 바꾼다. 지도 위 팝오버가 아니라 아래 줄에 펴 두는 이유:
            선을 누른 손이 그대로 다음 선택으로 이어지고, 좁은 화면에서도 가려지지 않는다.
          */}
          {pickedEdge ? (
            <EdgeTargetPicker
              edge={detail.flow.edges.find((e) => e.id === pickedEdge) ?? null}
              screens={detail.screens.map((s) => ({ slug: s.slug, title: s.title }))}
              onClose={() => setPickedEdge(null)}
              onPick={(to) => {
                void retargetFlowEdge(slug, pickedEdge, to).then(() => {
                  setPickedEdge(null);
                  state.reload();
                });
              }}
            />
          ) : null}
        </div>
      ) : detail.screens.length === 0 ? (
        /*
         * "화면이 0개"와 "화면을 못 읽었다"를 한 분기가 같이 받고 있었다. 앞엣것은 정상이고
         * 뒤엣것만 오류인데, 갤러리에서 흐름을 만들 수 있게 된 뒤로는 앞엣것이 훨씬 흔하다.
         */
        <FlowEmptyScreens slug={slug} onAdded={state.reload} />
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
                  const id = node.props.id;
                  if (!id) return;
                  if (wiring) setWiringNode(id);
                  else go(id);
                },
                activeId: wiringNode,
                // 연결된 자리를 표시한다 — 시연 중 "어디를 누르면 되나"를 물어보지 않아도 되게.
                // 번호는 순서 의미가 없으므로 모두 같은 값을 준다(존재 자체가 신호다).
                // 배선 중에는 늘 표시한다 — 어디가 이미 연결됐는지 보면서 정해야 한다.
                markers:
                  hint || wiring ? new Map([...exits.keys()].map((id) => [id, 0])) : new Map(),
              },
              true,
            )}
          </PageFrame>

          {wiring ? (
            <HotspotPanel
              nodeId={wiringNode}
              currentTo={wiringNode ? (exits.get(wiringNode) ?? null) : null}
              screens={detail.screens.map((s) => ({ slug: s.slug, title: s.title }))}
              onPick={(to) => {
                if (!active || !wiringNode) return;
                void linkFlowHotspot(slug, { fromSlug: active, nodeId: wiringNode, to }).then(() => {
                  setWiringNode(null);
                  state.reload();
                });
              }}
              onRemove={() => {
                if (!active || !wiringNode) return;
                void linkFlowHotspot(slug, {
                  fromSlug: active,
                  nodeId: wiringNode,
                  remove: true,
                }).then(() => {
                  setWiringNode(null);
                  state.reload();
                });
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}


function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-6 py-20 text-center">{children}</div>;
}

/**
 * 고른 연결의 목적지 고르기.
 *
 * 지금 목적지는 눌러도 아무 일이 없어야 한다 — 같은 값으로 바꾸는 건 히스토리만 늘린다.
 * 그래서 비활성으로 두고 "지금"이라고 적는다(숨기면 왜 없는지 모른다).
 */
function EdgeTargetPicker({
  edge,
  screens,
  onPick,
  onClose,
}: {
  edge: { id: string; from: { slug: string; nodeId: string; action?: string }; to: string } | null;
  screens: { slug: string; title: string }[];
  onPick: (to: string) => void;
  onClose: () => void;
}) {
  if (!edge) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-st-border bg-st-card px-4 py-3">
      <span className="text-step-n2 text-st-muted-foreground">
        <code className="font-mono">{edge.from.slug}</code> 의{" "}
        <code className="font-mono">{edge.from.nodeId}</code>
        {edge.from.action ? ` (${edge.from.action})` : ""} →
      </span>
      {screens.map((screen) => {
        const current = screen.slug === edge.to;
        return (
          <button
            key={screen.slug}
            type="button"
            disabled={current}
            onClick={() => onPick(screen.slug)}
            className={cn(
              "press rounded-full border px-3 py-1 text-step-n2",
              current
                ? "cursor-default border-st-primary bg-st-primary text-st-primary-foreground"
                : "border-st-border hover:bg-st-muted/60",
            )}
          >
            {screen.title}
            {current ? " (지금)" : ""}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto text-step-n2 text-st-muted-foreground underline"
      >
        닫기
      </button>
    </div>
  );
}

/**
 * 핫스팟 배선 — "이 자리를 누르면 어디로 갈까".
 *
 * 화면 위 팝오버가 아니라 프레임 아래 줄에 둔다. 프레임은 최대 2560px 라 위에 띄우면 스크롤을
 * 따라 화면 밖으로 밀리고, 지목한 요소를 가리기도 한다.
 */
function HotspotPanel({
  nodeId,
  currentTo,
  screens,
  onPick,
  onRemove,
}: {
  nodeId: string | null;
  currentTo: string | null;
  screens: { slug: string; title: string }[];
  onPick: (to: string) => void;
  onRemove: () => void;
}) {
  if (!nodeId) {
    return (
      <p className="mt-3 text-step-n2 text-st-muted-foreground">
        연결할 자리를 화면에서 눌러 주세요. 이미 연결된 자리에는 표시가 붙어 있습니다.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-st-border bg-st-card px-4 py-3">
      <span className="text-step-n2 text-st-muted-foreground">
        <code className="font-mono">{nodeId}</code> 를 누르면 →
      </span>
      {screens.map((screen) => {
        const current = screen.slug === currentTo;
        return (
          <button
            key={screen.slug}
            type="button"
            disabled={current}
            onClick={() => onPick(screen.slug)}
            className={cn(
              "press rounded-full border px-3 py-1 text-step-n2",
              current
                ? "cursor-default border-st-primary bg-st-primary text-st-primary-foreground"
                : "border-st-border hover:bg-st-muted/60",
            )}
          >
            {screen.title}
            {current ? " (지금)" : ""}
          </button>
        );
      })}
      {currentTo ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-step-n2 text-st-destructive underline"
        >
          연결 끊기
        </button>
      ) : null}
    </div>
  );
}
