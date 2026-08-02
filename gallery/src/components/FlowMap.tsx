import { lazy, Suspense, useMemo, type ComponentType } from "react";
import { COL_W, layoutScreens } from "../lib/flow-map-layout";
import { cn } from "../lib/cn";

/**
 * 흐름 지도 — 화면과 연결을 한눈에 본다.
 *
 * ── 왜 `@xyflow/react` 를 들였나
 * 갤러리는 부품을 대개 직접 만든다(툴팁·팝오버·타임라인·코드 하이라이터…). 기준은 "제대로
 * 만들려면 그 자체가 프로젝트가 되는 것만 들인다"이고, 지도는 그 예외다 — pan/zoom, 엣지
 * 라우팅, 뷰포트 맞춤, 드래그 배선은 각각이 다시 하나의 프로젝트다. `gallery/README.md` 참고.
 *
 * ── 왜 동적 import 인가
 * 지도는 라우트 하나에서만 쓰는데 라이브러리 트리는 1.9MB 다. 정적으로 import 하면 컴포넌트
 * 갤러리만 보는 사람의 **첫 로딩에도** 그게 딸려온다. 흐름 탭을 열 때 받아 오면 된다.
 */

/** 지도 본체는 xyflow 를 쓰므로 필요할 때 받아 온다. */
const Canvas = lazy(async () => {
  const [flow] = await Promise.all([
    import("@xyflow/react"),
    // 스타일도 함께 — 없으면 노드가 겹쳐 그려져 지도가 아니라 더미로 보인다.
    import("@xyflow/react/dist/style.css"),
  ]);
  return { default: makeCanvas(flow) };
});

/**
 * 지도가 필요로 하는 **최소한의** 모양만 받는다.
 *
 * `instant-elements/flow` 를 새로 export 하지 않는 이유: 공개 타입이 하나 늘면 그때부터
 * 소비자가 그 모양에 기대게 되고, 흐름 스키마를 바꿀 때마다 semver 를 따져야 한다. 지도는
 * slug 와 연결만 알면 되므로 구조적으로 좁혀 받는다(FlowRoute 도 같은 방식이다).
 */
export interface FlowMapScreen {
  slug: string;
}

export interface FlowMapEdge {
  id?: string;
  from: { slug: string; action?: string; value?: string };
  to: string;
}

export interface FlowMapProps {
  screens: FlowMapScreen[];
  edges: FlowMapEdge[];
  start?: string | undefined;
  /** 지금 보고 있는 화면 — 지도에서 강조한다. */
  active: string | null;
  onPick: (slug: string) => void;
  /**
   * 핸들을 끌어 목적지를 바꿨을 때. 없으면 배선이 잠긴다(읽기 전용 지도).
   *
   * **목적지만** 바꾼다 — 출발은 "어느 화면의 어느 노드의 어느 액션"이라 썸네일에서 고를 수
   * 없다. 그래서 새 연결을 만드는 게 아니라 이미 있는 연결의 끝을 옮기는 것이다.
   */
  onRetarget?: (edgeId: string, to: string) => void;
  /**
   * 핸들에서 새 연결을 끌었을 때.
   *
   * 지도에서는 새 연결을 만들 수 없다 — 출발이 "어느 화면의 어느 노드의 어느 액션"인데
   * 썸네일에서는 그걸 고를 수 없기 때문이다. 그렇다고 아무 일도 안 하면 고장으로 읽히므로,
   * **왜 안 되는지 말할 기회**를 호출자에게 넘긴다.
   */
  onConnectAttempt?: () => void;
  /**
   * 연결을 눌렀을 때.
   *
   * 드래그로도 목적지를 바꿀 수 있지만(위 `onRetarget`), 2px 짜리 선의 끝을 정확히 집는 건
   * 마우스로도 성가시고 터치에서는 사실상 불가능하다. 눌러서 고르는 길을 함께 둔다.
   */
  onEdgeSelect?: (edgeId: string) => void;
  /**
   * 스냅샷이 없어 최신본으로 대체된 화면들 — 시연이 흔들릴 수 있다는 신호.
   *
   * **Set 이 아니라 배열로 받는다.** 호출부가 JSX 안에서 `new Set(...)` 을 만들면 렌더마다
   * 새 객체가 되고, 그게 아래 `nodes` 메모를 매번 무효화해 xyflow 가 노드를 재등록한다 —
   * 그 사이 엣지가 그려지지 않는 일이 실제로 있었다(선이 보였다 안 보였다 했다).
   * 배열이면 데이터가 안 바뀌는 한 같은 참조가 유지된다.
   */
  staleSlugs?: string[];
}

export function FlowMap(props: FlowMapProps) {
  return (
    <Suspense
      fallback={
        <div className="grid h-[28rem] place-items-center rounded-xl border border-st-border bg-st-card">
          <p className="text-step-n2 text-st-muted-foreground">지도를 불러오는 중…</p>
        </div>
      }
    >
      <Canvas {...props} />
    </Suspense>
  );
}

/**
 * xyflow 모듈을 받은 뒤에야 컴포넌트를 만든다.
 *
 * 최상위에서 import 하면 lazy 의 뜻이 사라진다(모듈 그래프에 정적으로 걸린다). 그래서 타입만
 * 받아 두고 실제 컴포넌트는 여기서 조립한다.
 */
function makeCanvas(flow: typeof import("@xyflow/react")): ComponentType<FlowMapProps> {
  const { ReactFlow, Background, Controls, Handle, Position } = flow;

  /** 화면 카드. 좌우에 핸들을 달아 간선이 카드 가장자리에서 시작·도착하게 한다. */
  function ScreenNode({ data }: { data: Record<string, unknown> }) {
    const label = String(data["label"] ?? "");
    const active = Boolean(data["active"]);
    const isStart = Boolean(data["isStart"]);
    const stale = Boolean(data["stale"]);
    const outgoing = Number(data["outgoing"] ?? 0);

    return (
      <div
        className={cn(
          "w-72 rounded-xl border bg-st-card px-4 py-3 text-left shadow-sm transition-colors",
          active ? "border-st-primary ring-2 ring-st-primary/30" : "border-st-border",
        )}
      >
        {/*
          목적지 핸들만 연결을 **받는다**. 재연결(선 끝을 다른 카드로 끌기)이 여기 떨어져야
          목적지가 바뀐다.
        */}
        <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-st-muted-foreground" />
        <div className="flex items-center gap-2">
          {isStart ? (
            <span className="rounded-full bg-st-primary px-2 py-0.5 text-step-n2 text-st-primary-foreground">
              시작
            </span>
          ) : null}
          <span className="min-w-0 truncate text-step-n1 font-medium">{label}</span>
        </div>
        <p className="mt-1 text-step-n2 text-st-muted-foreground">
          {outgoing > 0 ? `연결 ${outgoing}개` : "나가는 연결 없음"}
          {stale ? " · 스냅샷 없음" : ""}
        </p>
        {/*
          출발 핸들도 연결 가능한 채로 둔다. 새 연결을 막는 건 아래 `onConnect` 가 맡는다 —
          핸들 단에서 막으면 재연결(선 끝을 다른 카드로 끌기)까지 함께 막힌다.
        */}
        <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-st-muted-foreground" />
      </div>
    );
  }

  const nodeTypes = { screen: ScreenNode };

  return function Canvas({
    screens,
    edges,
    start,
    active,
    onPick,
    staleSlugs,
    onRetarget,
    onConnectAttempt,
    onEdgeSelect,
  }: FlowMapProps) {
    const known = useMemo(() => new Set(screens.map((s) => s.slug)), [screens]);
    const staleSet = useMemo(() => new Set(staleSlugs ?? []), [staleSlugs]);

    const positions = useMemo(
      () => layoutScreens({ screens, edges, start }),
      [screens, edges, start],
    );

    const nodes = useMemo(
      () =>
        screens.map((screen) => ({
          id: screen.slug,
          type: "screen",
          position: positions[screen.slug] ?? { x: 0, y: 0 },
          data: {
            label: screen.slug,
            active: screen.slug === active,
            isStart: screen.slug === (start ?? screens[0]?.slug),
            stale: staleSet.has(screen.slug),
            outgoing: edges.filter((edge) => edge.from.slug === screen.slug).length,
          },
        })),
      [screens, positions, active, start, edges, staleSet],
    );

    const rfEdges = useMemo(
      () =>
        edges.map((edge, index) => {
          // 목적지가 사라진 간선 — 지우지 않고 빨갛게 남긴다. 안 보이면 고칠 생각을 못 한다.
          const broken = !known.has(edge.to) || !known.has(edge.from.slug);
          return {
            id: edge.id || `${edge.from.slug}->${edge.to}-${index}`,
            source: edge.from.slug,
            target: edge.to,
            animated: !broken,
            label: edge.from.action ? `${edge.from.action}${edge.from.value ? `: ${edge.from.value}` : ""}` : undefined,
            style: broken ? { stroke: "var(--st-destructive)", strokeDasharray: "4 4" } : undefined,
          };
        }),
      [edges, known],
    );

    return (
      <div className="h-[28rem] overflow-hidden rounded-xl border border-st-border bg-st-card">
        <ReactFlow
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_event, node) => onPick(node.id)}
          onEdgeClick={(_event, e) => onEdgeSelect?.(e.id)}
          /*
           * 이미 연결된 선의 **끝을 다른 카드로 끌어다 놓으면** 목적지가 바뀐다. xyflow 는 이
           * 동작을 reconnect 로 부른다 — 새 연결(connect)과 달리 출발이 고정돼 있어, 우리가
           * 허용하려는 것과 정확히 맞는다.
           */
          edgesReconnectable={Boolean(onRetarget)}
          onReconnect={(oldEdge, connection) => {
            if (!onRetarget || !connection.target) return;
            if (connection.target === oldEdge.target) return;
            onRetarget(oldEdge.id, connection.target);
          }}
          // 새 연결은 만들 수 없다 — 왜 안 되는지 말해 주는 것이 여기서 할 수 있는 최선이다.
          onConnect={() => onConnectAttempt?.()}
          fitView
          // 한 화면짜리 흐름에서 카드가 화면을 꽉 채우지 않게 상한을 둔다.
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.5}
          // 좌표를 저장하지 않으므로 옮길 수 없게 한다 — 옮겨 봐야 새로고침이면 되돌아온다.
          nodesDraggable={false}
          // 재연결이 목적지 핸들에 떨어지려면 노드가 연결 가능해야 한다.
          nodesConnectable={Boolean(onRetarget)}
          proOptions={{ hideAttribution: false }}
          translateExtent={[
            [-COL_W, -COL_W],
            [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
          ]}
        >
          <Background gap={24} className="!bg-st-background" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    );
  };
}
