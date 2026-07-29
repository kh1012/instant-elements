import { Component, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import componentLoaders from "virtual:ie/components";
import demoLoaders from "virtual:ie/demos";
import {
  isContainerType,
  isLandmarkRole,
  isPrimitiveType,
  type PageNode,
  type NodeProps,
} from "instant-elements/page";
import { cn } from "../lib/cn";
import { flowOf, sizingStyle, type ParentFlow } from "./sizing";

/**
 * 페이지 트리를 실제 화면으로 그린다.
 *
 * 세 종류의 노드가 있다:
 *  - **레이아웃 컨테이너**(Stack·Row·Grid·Frame) — 자식을 `props.items` 에 담는다
 *  - **레이아웃 leaf**(Heading·Text·Spacer·Placeholder) — 자리와 1차 콘텐츠
 *  - **레지스트리 컴포넌트** — 페이지가 지정한 props 로 실 컴포넌트를 그린다
 *
 * 레지스트리 컴포넌트는 props 가 있으면 실 컴포넌트를, 없으면 데모로 폴백한다 — 초안 단계엔
 * props 가 비어 있어도 "무엇이 놓일 자리인지" 는 보여야 하기 때문.
 */

const lazyComponents: Record<string, ComponentType<Record<string, unknown>>> = {};
for (const [name, loader] of Object.entries(componentLoaders)) {
  lazyComponents[name] = lazy(loader) as ComponentType<Record<string, unknown>>;
}
const lazyDemos: Record<string, ComponentType> = {};
for (const [name, loader] of Object.entries(demoLoaders)) {
  lazyDemos[name] = lazy(loader);
}

class NodeBoundary extends Component<
  { children: ReactNode; label: string },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error("[instant-elements] 노드 렌더 실패:", this.props.label, error);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-md border border-dashed border-st-destructive px-3 py-2 text-step-n2 text-st-destructive">
        {this.props.label} 을 그리지 못했습니다
      </div>
    );
  }
}

/** 랜드마크 역할 → 실제 DOM 태그. 최상위에서 한 번씩만 쓰인다. */
const LANDMARK_TAG = {
  header: "header",
  navigation: "nav",
  main: "main",
  footer: "footer",
  sidebar: "aside",
} as const;

/** `props` 에서 렌더에 넘기지 말아야 할 키를 걷어낸다(자식·식별자·편집 신호). */
function componentProps(props: NodeProps): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key === "items" || key === "id" || key.startsWith("_") || key === "hidden") continue;
    out[key] = value;
  }
  return out;
}

function Placeholder({ label, height }: { label?: unknown; height?: unknown }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-st-border bg-st-muted/40 px-3 text-step-n2 text-st-muted-foreground"
      style={{ minHeight: typeof height === "number" ? height : 64 }}
    >
      {typeof label === "string" && label ? label : "여기에 무엇이 놓일 자리"}
    </div>
  );
}

function LeafNode({ node }: { node: PageNode }) {
  const { type, props } = node;
  if (type === "Heading") {
    const level = typeof props["level"] === "number" ? Math.min(Math.max(props["level"], 1), 4) : 2;
    const size = ["text-step-3", "text-step-2", "text-step-1", "text-step-0"][level - 1];
    const Tag = `h${level}` as "h1";
    return <Tag className={cn(size, "font-semibold")}>{String(props["text"] ?? "")}</Tag>;
  }
  if (type === "Text") {
    return (
      <p className={cn("text-step-n1", props["muted"] === "yes" && "text-st-muted-foreground")}>
        {String(props["text"] ?? "")}
      </p>
    );
  }
  if (type === "Spacer") {
    return <div style={{ height: typeof props["size"] === "number" ? props["size"] : 16 }} />;
  }
  return <Placeholder label={props["label"]} height={props["height"]} />;
}

function ContainerNode({ node, children }: { node: PageNode; children: ReactNode }) {
  const { type, props } = node;
  const gap = typeof props["gap"] === "number" ? props["gap"] : undefined;

  if (type === "Grid") {
    const cols = typeof props["cols"] === "number" ? props["cols"] : 2;
    return (
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
        {children}
      </div>
    );
  }
  if (type === "Row") {
    return (
      <div
        style={{
          display: "flex",
          gap,
          alignItems: typeof props["align"] === "string" ? props["align"] : undefined,
          justifyContent: typeof props["justify"] === "string" ? props["justify"] : undefined,
          flexWrap: props["wrap"] === "yes" ? "wrap" : undefined,
        }}
      >
        {children}
      </div>
    );
  }
  // Stack · Frame — 세로 흐름. Frame 은 padding 을 자기 몫으로 갖는다.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        padding: type === "Frame" && typeof props["padding"] === "number" ? props["padding"] : undefined,
      }}
    >
      {children}
    </div>
  );
}

function RegistryNode({ node }: { node: PageNode }) {
  const given = componentProps(node.props);
  const Component_ = lazyComponents[node.type];
  const Demo = lazyDemos[node.type];

  // props 를 실제로 지정했으면 실 컴포넌트를 그린다 — 리뷰어가 결과를 봐야 리뷰가 성립한다.
  if (Component_ && Object.keys(given).length > 0) {
    return (
      <Suspense fallback={<Placeholder label={`${node.type} 불러오는 중…`} height={64} />}>
        <Component_ {...given} />
      </Suspense>
    );
  }
  if (Demo) {
    return (
      <Suspense fallback={<Placeholder label={`${node.type} 불러오는 중…`} height={64} />}>
        <Demo />
      </Suspense>
    );
  }
  return <Placeholder label={`미해결 컴포넌트: ${node.type}`} height={64} />;
}

export interface RenderOptions {
  /** 노드를 클릭할 수 있게 한다(피드백 지목). */
  onNodeClick?: (node: PageNode) => void;
  /** 지금 강조할 노드 id. */
  activeId?: string | null;
  /** 피드백이 달린 노드 id → 목록에서의 번호. 번호가 있어야 패널의 몇 번 항목인지 이어진다. */
  markers?: Map<string, number>;
}

export function renderNodes(
  nodes: PageNode[],
  parent: ParentFlow,
  options: RenderOptions,
  topLevel = false,
): ReactNode[] {
  // 같은 랜드마크가 최상위에 둘 이상이면 첫 노드만 시맨틱 태그를 갖는다 — 중복 랜드마크는
  // 스크린리더 내비게이션을 흐린다. 렌더가 코드로 막는다.
  const usedLandmarks = new Set<string>();

  return nodes
    .filter((node) => node.props.hidden !== true)
    .map((node, index) => {
      const role = node.props._role;
      let landmark: keyof typeof LANDMARK_TAG | null = null;
      if (topLevel && isLandmarkRole(role) && !usedLandmarks.has(role)) {
        usedLandmarks.add(role);
        landmark = role;
      }
      return (
        <RenderNode
          key={node.props.id ?? `${node.type}-${index}`}
          node={node}
          parent={parent}
          options={options}
          landmark={landmark}
        />
      );
    });
}

function RenderNode({
  node,
  parent,
  options,
  landmark,
}: {
  node: PageNode;
  parent: ParentFlow;
  options: RenderOptions;
  landmark: keyof typeof LANDMARK_TAG | null;
}) {
  const id = node.props.id;
  const style = sizingStyle(node.props, parent);
  const clickable = Boolean(options.onNodeClick && id);

  let inner: ReactNode;
  if (isContainerType(node.type)) {
    inner = (
      <ContainerNode node={node}>
        {renderNodes(node.props.items ?? [], flowOf(node.type), options)}
      </ContainerNode>
    );
  } else if (isPrimitiveType(node.type)) {
    inner = <LeafNode node={node} />;
  } else {
    inner = <RegistryNode node={node} />;
  }

  const Tag = (landmark ? LANDMARK_TAG[landmark] : "div") as "div";
  const sticky =
    node.props._regionSticky === "sticky" && (landmark === "header" || landmark === "sidebar");

  return (
    <Tag
      data-node-id={id}
      data-node-type={node.type}
      style={{ ...style, ...(sticky ? { position: "sticky", top: 0, zIndex: 5 } : {}) }}
      className={cn(
        "relative",
        clickable && "cursor-pointer outline-offset-2 hover:outline-2 hover:outline-st-primary/50",
        options.activeId === id && "outline-2 outline-st-primary",
        id && options.markers?.has(id) && "outline-2 outline-dashed outline-st-info",
      )}
      onClick={
        clickable
          ? (event) => {
              // 가장 안쪽 노드만 잡는다 — 조상까지 함께 열리면 어디를 가리켰는지 모호해진다.
              event.stopPropagation();
              options.onNodeClick?.(node);
            }
          : undefined
      }
    >
      {/* 번호 마커 — 미리보기의 이 자리가 패널의 몇 번 피드백인지 눈으로 잇는다.
          점선 테두리만으로는 "무언가 달렸다"까지만 알 수 있다. */}
      {id && (options.markers?.get(id) ?? 0) > 0 ? (
        <span className="pointer-events-none absolute -left-2 -top-2 z-10 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-st-info px-1 text-step-n2 font-medium text-st-background shadow-sm">
          {options.markers?.get(id)}
        </span>
      ) : null}
      <NodeBoundary label={node.props._label ?? node.type}>{inner}</NodeBoundary>
    </Tag>
  );
}
