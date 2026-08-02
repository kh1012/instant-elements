/**
 * 지도 자동 배치 — 시작 화면에서 BFS 로 깊이를 매겨 **열**로 세운다.
 *
 * ── 왜 좌표를 저장하지 않나
 * 흐름 파일에 좌표를 넣으면 그때부터 "지도에서 옮긴 위치"가 시연 데이터의 일부가 된다. 화면을
 * 넣고 빼는 것과 별개로 관리해야 하고, 여럿이 만지면 좌표만 충돌한다. 시연 흐름은 대개 선형에
 * 몇 갈래가 붙는 모양이라 깊이 기반 열 배치로 충분하다(20화면을 넘길 일이 드물다는 전제 —
 * 넘으면 그때 좌표 저장을 고민한다).
 *
 * ── 닿지 않는 화면
 * 시작에서 아무도 연결하지 않은 화면은 마지막 열 **뒤에** 따로 세운다. 배치에서 빠지면 지도에
 * 안 보이고, 안 보이면 "연결을 깜빡했다"는 사실 자체를 모르게 된다.
 *
 * _근거: 상류 하네스 lib/flow-map-layout.ts._
 */

/** 카드 폭(288) + 여백. 간선이 많아질수록 열 간격이 값을 한다 — 좁으면 선이 카드를 가로지른다. */
export const COL_W = 460;
export const ROW_H = 300;

export interface LayoutInput {
  screens: { slug: string }[];
  edges: { from: { slug: string }; to: string; broken?: boolean }[];
  start?: string | undefined;
}

export function layoutScreens({
  screens,
  edges,
  start,
}: LayoutInput): Record<string, { x: number; y: number }> {
  const slugs = screens.map((screen) => screen.slug);
  const known = new Set(slugs);

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    // 끊긴 간선은 배치에 영향을 주지 않는다 — 죽은 경로가 레이아웃을 끌고 다니면 지도가 왜곡된다.
    if (edge.broken || !known.has(edge.from.slug) || !known.has(edge.to)) continue;
    const list = adjacency.get(edge.from.slug) ?? [];
    if (!list.includes(edge.to)) list.push(edge.to);
    adjacency.set(edge.from.slug, list);
  }

  const depth = new Map<string, number>();
  const root = start && known.has(start) ? start : slugs[0];
  if (root) {
    const queue: string[] = [root];
    depth.set(root, 0);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const d = depth.get(current) ?? 0;
      for (const next of adjacency.get(current) ?? []) {
        if (depth.has(next)) continue;
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : -1;
  const columns = new Map<number, string[]>();
  for (const slug of slugs) {
    const d = depth.get(slug) ?? maxDepth + 1;
    const column = columns.get(d) ?? [];
    column.push(slug);
    columns.set(d, column);
  }

  const out: Record<string, { x: number; y: number }> = {};
  for (const [d, column] of columns) {
    column.forEach((slug, index) => {
      out[slug] = { x: d * COL_W, y: index * ROW_H };
    });
  }
  return out;
}
