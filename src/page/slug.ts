import { basename, resolve } from "node:path";

/**
 * 페이지 슬러그.
 *
 * 영소문자·숫자·하이픈에 **한글 음절**을 더한다. 한글을 버리면 "대시보드 초안" 같은 제목이
 * 전부 타임스탬프 폴백으로 떨어져 URL 과 검색이 무의미해진다.
 *
 * 경로 안전: `.`·`/`·`\` 를 문자 집합에 넣지 않으므로 `..` 나 하위경로가 구조적으로 불가능하다.
 */
export const SLUG_RE = /^[a-z0-9가-힣][a-z0-9가-힣-]{0,63}$/;

/**
 * 한글 파일명 정규화.
 *
 * macOS 는 한글 파일명을 NFD 로 저장하는데 브라우저·입력은 NFC 다. 그대로 비교하면 같은 이름이
 * 다르게 취급된다 — 슬러그를 다루는 모든 입구에서 한 번씩 통과시킨다.
 */
export function normalizeSlug(slug: string): string {
  return typeof slug === "string" ? slug.normalize("NFC") : slug;
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(normalizeSlug(slug));
}

/** `<dir>/<slug><ext>` 절대경로. 디렉토리 봉쇄로 traversal 차단. 유효하지 않으면 null. */
export function fileIn(dir: string, slug: string, ext: string): string | null {
  const normalized = normalizeSlug(slug);
  if (!SLUG_RE.test(normalized)) return null;
  const name = `${normalized}${ext}`;
  const path = resolve(dir, name);
  if (resolve(dir) !== resolve(path, "..") || basename(path) !== name) return null;
  return path;
}

/**
 * 제목 → 슬러그.
 *
 * 글자가 하나도 남지 않으면(예: "2026 / 3") 타임스탬프로 폴백한다 — 기호만 남은 슬러그는
 * URL 에서 의미를 전혀 못 주기 때문. 한 글자라도 남으면 그대로 쓴다("dashboard 3분기"→"dashboard-3분기").
 */
export function slugify(title: string, now = Date.now()): string {
  const slug = String(title)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/, "");
  return /[a-z가-힣]/.test(slug) ? slug : `page-${now}`;
}
