import { isContainerType, isPrimitiveType, type PageData, type PageNode } from "./schema.js";

/**
 * 페이지 데이터 검증.
 *
 * ── 왜 필요한가
 * `page-create` GUIDE 는 "모든 노드에 유일한 id", "자식은 반드시 props.items" 를 하드룰로 적어 두지만,
 * 그걸 **강제하는 게 없으면 규칙이 아니라 희망**이다. 실제로 id 없는 노드도, `children` 오용도,
 * 없는 컴포넌트 이름도 전부 저장에 성공하고 초록 체크와 딥링크까지 받았다. 그러고 나서 화면이
 * 조용히 비어 있는 것을 사람이 발견해야 했다.
 *
 * 이 세 가지는 특히 **조용히** 깨진다:
 *  - id 누락·중복 → 피드백이 그 자리를 못 가리키고, 흐름 연결이 어느 노드인지 모호해진다
 *  - `children` → 렌더가 읽지 않으므로 컨테이너가 그냥 빈다
 *  - 없는 컴포넌트 → 자리표시로 격하되는데, 저작자는 넣었다고 믿는다
 */

export interface PageIssue {
  level: "error" | "warn";
  /** 문제가 있는 노드 경로(`content[1] > Stack-1`). */
  path: string;
  message: string;
  hint?: string;
}

export interface ValidatePageOptions {
  /** 레지스트리에 등록된 컴포넌트 이름. 주면 없는 type 을 잡는다. */
  knownComponents?: Set<string>;
  /** 데모가 있어 실제로 렌더되는 컴포넌트. 주면 렌더 불가를 경고한다. */
  renderableComponents?: Set<string>;
}

/** 컨테이너가 아닌데 자식을 담으려 한 흔적 — 렌더가 읽지 않는 키들. */
const CHILD_LIKE_KEYS = ["children", "content", "nodes", "items"];

export function validatePageData(data: PageData, options: ValidatePageOptions = {}): PageIssue[] {
  const issues: PageIssue[] = [];
  const seenIds = new Map<string, string>();

  function walk(nodes: PageNode[], trail: string[], rootLevel: boolean): void {
    nodes.forEach((node, index) => {
      if (!node || typeof node !== "object" || typeof node.type !== "string") {
        issues.push({
          level: "error",
          path: [...trail, `[${index}]`].join(" > "),
          message: "노드가 아닙니다(type 이 없습니다).",
        });
        return;
      }

      const props = node.props ?? ({} as PageNode["props"]);
      // 최상위는 배열 위치를, 그 아래는 id 를 앞세운다. 최상위도 id 가 있으면 함께 적는다 —
      // 위치만으로는 어느 노드인지, id 만으로는 어디쯤인지 알기 어렵다.
      const label = rootLevel
        ? props.id
          ? `content[${index}]:${props.id}`
          : `content[${index}]`
        : (props.id ?? `${node.type}[${index}]`);
      const path = [...trail, label].join(" > ");

      // ── id
      if (typeof props.id !== "string" || !props.id.trim()) {
        issues.push({
          level: "error",
          path,
          message: `${node.type} 에 props.id 가 없습니다.`,
          hint: "id 가 없으면 리뷰 피드백이 이 자리를 가리킬 수 없고 흐름이 연결할 수도 없습니다.",
        });
      } else if (seenIds.has(props.id)) {
        issues.push({
          level: "error",
          path,
          message: `id 중복: ${props.id}`,
          hint: `이미 ${seenIds.get(props.id)} 에서 썼습니다. 피드백과 흐름이 어느 쪽인지 구분하지 못합니다.`,
        });
      } else {
        seenIds.set(props.id, path);
      }

      // ── 자식
      const isContainer = isContainerType(node.type);
      for (const key of CHILD_LIKE_KEYS) {
        if (key === "items") continue;
        if (props[key] !== undefined) {
          issues.push({
            level: "error",
            path,
            message: `자식을 props.${key} 에 두었습니다.`,
            hint: "렌더는 props.items 만 읽습니다 — 이대로 저장하면 이 컨테이너는 빈 채로 그려집니다.",
          });
        }
      }
      if (props.items !== undefined && !Array.isArray(props.items)) {
        issues.push({ level: "error", path, message: "props.items 는 배열이어야 합니다." });
      }
      if (!isContainer && Array.isArray(props.items) && props.items.length > 0) {
        issues.push({
          level: "error",
          path,
          message: `${node.type} 은 자식을 담을 수 없습니다.`,
          hint: "컨테이너는 Stack · Row · Grid · Frame 뿐입니다.",
        });
      }

      // ── type
      if (!isPrimitiveType(node.type)) {
        if (options.knownComponents && !options.knownComponents.has(node.type)) {
          issues.push({
            level: "error",
            path,
            message: `레지스트리에 없는 컴포넌트: ${node.type}`,
            hint: '아직 없다면 Placeholder 로 두고 라벨에 의도를 남기세요 — 예: { "type": "Placeholder", "props": { "id": "…", "label": "여기에 …" } }',
          });
        } else if (options.renderableComponents && !options.renderableComponents.has(node.type)) {
          issues.push({
            level: "warn",
            path,
            message: `데모가 없어 렌더되지 않습니다: ${node.type}`,
            hint: "미리보기에서 자리표시로 격하됩니다.",
          });
        }
      }

      if (Array.isArray(props.items)) {
        walk(props.items as PageNode[], [...trail, label], false);
      }
    });
  }

  if (!Array.isArray(data?.content)) {
    return [{ level: "error", path: "data", message: "content 가 배열이 아닙니다." }];
  }
  walk(data.content, [], true);
  return issues;
}

export function pageErrors(issues: PageIssue[]): PageIssue[] {
  return issues.filter((issue) => issue.level === "error");
}
