import type { Entry } from "instant-elements/registry";
import type { PageNode } from "instant-elements/page";
import type { FeedbackItem, PageDetail } from "./api";
import { CLI } from "./cli-name";

/** 구조 덤프 상한 — 프롬프트가 페이지 전문(수천 줄)이 되지 않게 자른다. 형태 파악이 목적이다. */
const STRUCTURE_LINE_LIMIT = 60;

/** 노드 id → 사람이 읽는 트리 경로(`content[1] > Grid-1 > stat-card-2`). */
function findNodePath(
  nodes: PageNode[],
  targetId: string,
  trail: string[] = [],
  rootLevel = true,
): string | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) continue;
    const label = rootLevel ? `content[${i}]` : (node.props.id ?? node.type);
    if (node.props.id === targetId) return [...trail, label].join(" > ");
    const items = node.props.items ?? [];
    if (items.length > 0) {
      const found = findNodePath(items, targetId, [...trail, label], false);
      if (found) return found;
    }
  }
  return null;
}

/** 구조 스케치를 들여쓰기 텍스트로 — 받는 쪽이 페이지 JSON 을 다시 읽지 않아도 형태를 안다. */
function renderStructure(nodes: PageNode[], depth = 0, out: string[] = []): string[] {
  for (const node of nodes) {
    if (out.length >= STRUCTURE_LINE_LIMIT) {
      out.push(`${"  ".repeat(depth)}… (이하 생략 — 전체는 \`${CLI} page get\` 으로)`);
      return out;
    }
    const bits = [node.type];
    if (node.props._label) bits.push(`"${node.props._label}"`);
    if (node.props._role) bits.push(`·${node.props._role}`);
    if (typeof node.props.cols === "number") bits.push(`cols=${node.props.cols}`);
    if (node.props._widthMode) bits.push(node.props._widthMode);
    out.push(`${"  ".repeat(depth)}${bits.join(" ")} (${node.props.id})`);
    const items = node.props.items ?? [];
    if (items.length > 0) renderStructure(items, depth + 1, out);
  }
  return out;
}

/** 배치 요청된 컴포넌트 1건 → 실행에 필요한 정보. */
function componentBlock(name: string, entries: Entry[], importAlias: string): string[] {
  const entry = entries.find((e) => e.name === name);
  if (!entry) return [`- \`${name}\` (레지스트리에 없음 — 먼저 만들어야 합니다)`];
  const lines = [`- \`${name}\` (${entry.meta.category}) — ${entry.meta.summary}`];
  lines.push(`  import: ${importAlias}/${name}`);
  const props = entry.meta.props?.filter((p) => p.editable !== false) ?? [];
  if (props.length > 0) {
    lines.push(`  props: ${props.map((p) => `${p.name}:${p.type}`).join(" · ")}`);
  }
  return lines;
}

/**
 * 남긴 피드백 전부를 하나의 실행 가능한 프롬프트로 조립한다.
 *
 * 코멘트만 나열하면 받는 쪽이 "어느 페이지인지·현재 버전이 뭔지·어떻게 저장하는지·그 노드가
 * 트리 어디에 있는지"를 전부 다시 알아내야 한다. 그래서 대상 식별·동시성 안전 저장 절차·구조
 * 덤프·노드 경로를 함께 싣는다. 순수 프론트 로직이라 서버 왕복이 없다.
 */
export function buildFeedbackPrompt(
  page: PageDetail,
  items: FeedbackItem[],
  entries: Entry[],
  importAlias: string,
): string {
  const lines: string[] = [
    "# 페이지 리뷰 피드백 반영 요청",
    "",
    "아래 피드백을 반영해 이 페이지를 개선해줘. `page-create` 스킬 절차를 따른다:",
    "",
    "```bash",
    `${CLI} guide page-create`,
    "```",
    "",
    "## 대상 페이지",
    `- 제목: ${page.title || page.slug}`,
    `- slug: \`${page.slug}\``,
    `- 현재 버전: ${page.version}`,
    `- 최종 수정: ${page.updatedBy || "알 수 없음"} (${page.updatedAt?.slice(0, 10) || "-"})`,
    "",
    "## 저장 방법 (동시성 안전 — 통째로 덮어쓰기 금지)",
    "```bash",
    `${CLI} page get ${page.slug} > /tmp/page.json     # 여기 version 을 --base 에 넣는다`,
    `${CLI} page set ${page.slug} <편집한.json> \\`,
    `  --base <위 version> --action refined --note "리뷰 피드백 반영"`,
    "```",
    "",
    "## 현재 구조",
    "```",
    ...renderStructure(page.data.content),
    "```",
    "",
    `## 피드백 (${items.length}건)`,
    "",
  ];

  items.forEach((item, index) => {
    lines.push(
      item.nodeId
        ? `### ${index + 1}. ${item.nodeType ?? "요소"} · id \`${item.nodeId}\``
        : `### ${index + 1}. 페이지 전체`,
    );
    if (item.nodeId) {
      const path = findNodePath(page.data.content, item.nodeId);
      if (path) lines.push(`위치: ${path}`);
    }
    lines.push("코멘트:", `> ${item.comment.split("\n").join("\n> ")}`);
    if (item.components?.length) {
      lines.push("", "이 자리에 놓아 달라고 지목한 컴포넌트:");
      for (const name of item.components) {
        lines.push(...componentBlock(name, entries, importAlias));
      }
    }
    lines.push("");
  });

  lines.push(
    "## 마친 뒤",
    "반영이 끝나면 갤러리에서 피드백을 비워 주세요(전체 삭제). 남겨 두면 다음 리뷰에서 이미 처리된 건이 다시 섞입니다.",
  );

  return lines.join("\n").trimEnd();
}
