/**
 * 프로토타입 흐름 — `flows/<slug>.json`.
 *
 * ── 왜 페이지 본문이 아니라 별도 파일인가
 * 1. 지도가 "이번 시연"만 떼어 보려면 흐름이 1급 개체여야 한다. 본문에 흩으면 전역 그래프 하나가 된다.
 * 2. 같은 페이지가 여러 시연에 재사용된다 — 노드 하나당 목적지 하나로는 시나리오가 충돌한다.
 * 3. 페이지 파일은 `page-create` 스킬과 공유하는 계약이다. 링크를 본문에 넣으면 리파인 때
 *    조용히 밟히거나 스킬에게 새 규칙을 가르쳐야 한다.
 * 4. 페이지를 옛 버전으로 되돌릴 때 시연 배선까지 함께 되돌아가면 안 된다.
 */

export interface FlowEdge {
  id: string;
  /**
   * 출발 — 화면(slug) 안의 노드.
   *
   * `action`/`value` 는 그 노드가 레지스트리 컴포넌트일 때, 컴포넌트가 이미 선언한
   * `type:"action"` prop 에 직접 붙는다. `value` 가 있으면 콜백 인자가 그 값일 때만 이동한다 —
   * 탭 3개를 각각 다른 화면으로 보낼 수 있는 이유다. DOM 셀렉터와 달리 포털·라벨 보간·마크업
   * 변경에 영향받지 않는다. 컴포넌트의 공개 API 이기 때문이다.
   */
  from: {
    slug: string;
    nodeId: string;
    action?: string;
    value?: string;
  };
  /** 도착 화면 slug. */
  to: string;
}

/** 흐름에 편입된 화면. `version` 은 편입 시점에 박제한 스냅샷을 가리킨다. */
export interface FlowScreen {
  slug: string;
  version: string;
}

export interface FlowFile {
  version: string;
  name: string;
  updatedAt: string;
  updatedBy: string;
  /** 있으면 페이지의 `pageSize` 를 이긴다 — 시연 중 캔버스가 화면마다 리사이즈되면 못 쓴다. */
  frame?: string;
  /** 시연 시작 화면. 없으면 첫 화면. */
  start?: string;
  screens: FlowScreen[];
  edges: FlowEdge[];
}

/** 파일에서 온 값은 형태를 믿지 않는다 — 손상된 흐름 하나가 목록 전체를 죽이면 안 된다. */
export function normalizeFlow(raw: unknown): FlowFile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o["name"] !== "string") return null;

  const screens: FlowScreen[] = Array.isArray(o["screens"])
    ? o["screens"].flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const s = item as Record<string, unknown>;
        if (typeof s["slug"] !== "string" || typeof s["version"] !== "string") return [];
        return [{ slug: s["slug"], version: s["version"] }];
      })
    : [];

  const edges: FlowEdge[] = Array.isArray(o["edges"])
    ? o["edges"].flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const e = item as Record<string, unknown>;
        const from = e["from"] as Record<string, unknown> | undefined;
        if (!from || typeof from["slug"] !== "string" || typeof from["nodeId"] !== "string") return [];
        if (typeof e["to"] !== "string") return [];
        return [
          {
            id: typeof e["id"] === "string" ? e["id"] : `${from["slug"]}:${from["nodeId"]}→${e["to"]}`,
            from: {
              slug: from["slug"],
              nodeId: from["nodeId"],
              ...(typeof from["action"] === "string" ? { action: from["action"] } : {}),
              ...(typeof from["value"] === "string" ? { value: from["value"] } : {}),
            },
            to: e["to"],
          },
        ];
      })
    : [];

  return {
    version: typeof o["version"] === "string" ? o["version"] : "1.0.0",
    name: o["name"],
    updatedAt: typeof o["updatedAt"] === "string" ? o["updatedAt"] : "",
    updatedBy: typeof o["updatedBy"] === "string" ? o["updatedBy"] : "",
    ...(typeof o["frame"] === "string" ? { frame: o["frame"] } : {}),
    ...(typeof o["start"] === "string" ? { start: o["start"] } : {}),
    screens,
    edges,
  };
}

export interface FlowIntegrityIssue {
  level: "error" | "warn";
  message: string;
}

/**
 * 흐름의 정합성을 살핀다.
 *
 * 시연 도중 "왜 안 넘어가지" 를 겪지 않게 미리 알린다. 특히 **노드 id 가 사라진 경우** —
 * 페이지를 리파인하며 id 를 바꾸면 그 자리의 연결이 조용히 끊긴다.
 */
export function checkFlowIntegrity(
  flow: FlowFile,
  nodeIdsByScreen: Record<string, Set<string>>,
): FlowIntegrityIssue[] {
  const issues: FlowIntegrityIssue[] = [];
  const known = new Set(flow.screens.map((s) => s.slug));

  if (flow.screens.length === 0) {
    issues.push({ level: "warn", message: "편입된 화면이 없습니다." });
  }
  if (flow.start && !known.has(flow.start)) {
    issues.push({ level: "error", message: `시작 화면이 편입돼 있지 않습니다: ${flow.start}` });
  }

  for (const edge of flow.edges) {
    if (!known.has(edge.from.slug)) {
      issues.push({ level: "error", message: `출발 화면이 편입돼 있지 않습니다: ${edge.from.slug}` });
      continue;
    }
    if (!known.has(edge.to)) {
      issues.push({ level: "error", message: `도착 화면이 편입돼 있지 않습니다: ${edge.to}` });
    }
    const nodes = nodeIdsByScreen[edge.from.slug];
    if (nodes && !nodes.has(edge.from.nodeId)) {
      issues.push({
        level: "error",
        message: `노드가 사라졌습니다: ${edge.from.slug} / ${edge.from.nodeId}`,
      });
    }
  }

  const reachable = new Set<string>([flow.start ?? flow.screens[0]?.slug ?? ""]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of flow.edges) {
      if (reachable.has(edge.from.slug) && !reachable.has(edge.to)) {
        reachable.add(edge.to);
        grew = true;
      }
    }
  }
  for (const screen of flow.screens) {
    if (!reachable.has(screen.slug)) {
      issues.push({ level: "warn", message: `시작점에서 닿을 수 없습니다: ${screen.slug}` });
    }
  }

  return issues;
}
