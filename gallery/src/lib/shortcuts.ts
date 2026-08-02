/**
 * 단축키의 유일한 출처.
 *
 * 표기(⌘ K)와 핸들러(metaKey)와 `aria-keyshortcuts`(Meta+K)가 서로 다른 파일에 흩어져 있으면
 * 반드시 어긋난다 — 그리고 어긋난 단축키 안내는 없느니만 못하다. 사람이 그대로 눌러 보고
 * 안 되면 나머지 안내까지 못 믿게 된다.
 */

/**
 * mac 에 `Ctrl` 이라고 적으면 안 된다. 핸들러는 `metaKey`·`ctrlKey` 를 둘 다 받지만,
 * **글자로 알려 주는 것이 이 표기의 목적**이라 실제로 눌러야 하는 키와 같아야 한다.
 */
export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const MOD = IS_MAC ? "⌘" : "Ctrl";

export interface Shortcut {
  /** 화면에 적을 글자. */
  keys: string;
  /** `aria-keyshortcuts` 값 — 보조기술이 읽는 형식은 표기와 다르다. */
  aria: string;
  /** 단축키 목록에 적을 설명. */
  label: string;
}

export const SHORTCUTS = {
  palette: { keys: `${MOD} K`, aria: IS_MAC ? "Meta+K" : "Control+K", label: "전체 검색 열기" },
  search: { keys: "/", aria: "/", label: "검색창으로 이동" },
  runPanel: {
    keys: `${MOD} ⇧ A`,
    aria: IS_MAC ? "Meta+Shift+A" : "Control+Shift+A",
    label: "실행 로그 열고 닫기",
  },
  theme: {
    keys: `${MOD} ⇧ L`,
    aria: IS_MAC ? "Meta+Shift+L" : "Control+Shift+L",
    label: "라이트·다크 전환",
  },
  help: { keys: "?", aria: "?", label: "단축키 목록" },
} satisfies Record<string, Shortcut>;

/**
 * 지금 글을 쓰는 중인가.
 *
 * 글자 키 단축키(`/`, `?`)는 입력 중에 발동하면 안 된다 — 검색어에 슬래시를 치면 팔레트가
 * 뜨는 식으로, 도구가 사람이 친 글자를 빼앗는다.
 */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable === true
  );
}

/** ⌘/Ctrl 어느 쪽이든 인정한다 — 외장 키보드를 바꿔 쓰는 사람이 있다. */
export function hasMod(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}
