import type { PageNode } from "instant-elements/page";
import { isPrimitiveType } from "instant-elements/page";
import { cn } from "../lib/cn";

/**
 * 구조 스케치 — 라이브 렌더 대신 **뼈대만** 보여주는 모드.
 *
 * 두 가지가 필요하다:
 *  - `최소` : 타입 이름만. 트리가 어떻게 짜였는지 한눈에 본다. 컴포넌트가 무거워도 즉시 뜬다.
 *  - `요약` : 타입 + 별칭·역할·크기 지정. "이 자리가 무엇이고 어떻게 놓이는가" 를 읽는다.
 *
 * 라이브만 있으면 구조가 콘텐츠에 묻힌다. 특히 초안 단계에서는 배치가 맞았는지가 더 중요하다.
 */

export type SketchMode = "minimal" | "summary";

function describe(node: PageNode, mode: SketchMode): string {
  if (mode === "minimal") return node.type;

  const parts = [node.type];
  if (node.props._label) parts.push(`"${node.props._label}"`);
  if (node.props._role) parts.push(`·${node.props._role}`);
  if (node.props._widthMode) {
    parts.push(node.props._width ? `${node.props._widthMode}:${node.props._width}` : node.props._widthMode);
  }
  if (typeof node.props.cols === "number") parts.push(`cols=${node.props.cols}`);
  if (typeof node.props._colSpan === "number") parts.push(`span=${node.props._colSpan}`);
  return parts.join(" ");
}

export function PageSketch({
  nodes,
  mode,
  depth = 0,
  onNodeClick,
  activeId,
  markers,
}: {
  nodes: PageNode[];
  mode: SketchMode;
  depth?: number;
  onNodeClick?: (node: PageNode) => void;
  activeId?: string | null;
  markers?: Map<string, number>;
}) {
  return (
    <ul className={cn("flex flex-col gap-1", depth > 0 && "ml-4 border-l border-st-border pl-3")}>
      {nodes
        .filter((node) => node.props.hidden !== true)
        .map((node, index) => {
          const id = node.props.id;
          const items = node.props.items ?? [];
          return (
            <li key={id ?? `${node.type}-${index}`}>
              <button
                type="button"
                onClick={() => onNodeClick?.(node)}
                disabled={!onNodeClick}
                className={cn(
                  "press w-full rounded-md border px-2.5 py-1.5 text-left text-step-n2",
                  isPrimitiveType(node.type)
                    ? "border-st-border bg-st-muted/40 text-st-muted-foreground"
                    : "border-st-border bg-st-card text-st-foreground",
                  onNodeClick && "hover:border-st-primary/60",
                  activeId === id && "border-st-primary ring-1 ring-st-primary",
                  id && markers?.has(id) && "border-dashed border-st-info",
                )}
              >
                <span className="font-mono">{describe(node, mode)}</span>
                {id ? <span className="ml-2 opacity-50">{id}</span> : null}
                {id && markers?.has(id) ? (
                  <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-st-info px-1 text-[10px] font-medium text-st-background">
                    {markers.get(id)}
                  </span>
                ) : null}
              </button>
              {items.length > 0 ? (
                <PageSketch
                  nodes={items}
                  mode={mode}
                  depth={depth + 1}
                  {...(onNodeClick ? { onNodeClick } : {})}
                  {...(activeId !== undefined ? { activeId } : {})}
                  {...(markers ? { markers } : {})}
                />
              ) : null}
            </li>
          );
        })}
    </ul>
  );
}
