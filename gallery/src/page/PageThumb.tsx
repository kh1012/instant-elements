import type { PreviewNode } from "../lib/api";
import { cn } from "../lib/cn";

/**
 * 페이지 목록 카드의 구조 썸네일.
 *
 * 사람은 페이지를 제목이 아니라 **모양**으로 기억한다. 목록에 제목만 있으면 "대시보드"와
 * "대시보드 초안" 중 어느 쪽이 내가 찾던 것인지 열어 봐야 안다. 실제 렌더는 무겁고 작은
 * 프레임에서 읽히지도 않으므로, 블록의 배치만 남긴 뼈대를 그린다.
 */

const isContainer = (type: string) => ["Stack", "Row", "Grid", "Frame"].includes(type);

function Block({ node, depth }: { node: PreviewNode; depth: number }) {
  const children = node.items ?? [];

  if (!isContainer(node.type)) {
    return (
      <div
        className={cn(
          "min-h-2.5 rounded-[2px] px-1 text-[7px] leading-[10px] text-st-muted-foreground",
          // 레지스트리 컴포넌트는 실체가 있는 블록, 프리미티브는 자리표시로 톤을 가른다.
          node.type === "Placeholder"
            ? "border border-dashed border-st-border"
            : "bg-st-muted",
        )}
      >
        {depth <= 2 ? node.type : null}
      </div>
    );
  }

  if (node.type === "Grid") {
    const cols = Math.min(node.cols ?? 2, 4);
    return (
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {children.map((child, index) => (
          <Block key={child.id ?? index} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-0.5", node.type === "Row" ? "flex-row" : "flex-col")}>
      {children.map((child, index) => (
        <div key={child.id ?? index} className={node.type === "Row" ? "min-w-0 flex-1" : ""}>
          <Block node={child} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

export function PageThumb({ nodes }: { nodes: PreviewNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-st-border text-step-n2 text-st-muted-foreground">
        비어 있음
      </div>
    );
  }
  return (
    <div className="flex h-28 flex-col gap-0.5 overflow-hidden rounded-md border border-st-border bg-st-background p-1.5">
      {nodes.map((node, index) => (
        <Block key={node.id ?? index} node={node} depth={0} />
      ))}
    </div>
  );
}
