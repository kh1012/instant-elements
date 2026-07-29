import { useEffect, useState } from "react";

/**
 * 즐겨찾기(핀) — 자주 쓰는 컴포넌트를 고정해 라이브러리 상단 '고정됨' 섹션에 모아 본다.
 *
 * ── 왜 localStorage 인가 (레지스트리가 아니라)
 * 핀은 **이 사람의 지금 작업 세트**다. 레지스트리 파일에 넣으면 커밋되고, 그 순간 한 사람이
 * 고정한 것이 팀 전체의 화면 위쪽을 차지한다. 브라우저별로 두는 게 이 기능에는 맞는 범위다.
 *
 * ── 왜 커스텀 이벤트까지
 * `storage` 이벤트는 **다른 탭**에서만 발생한다. 같은 문서 안의 카드와 목록이 서로 즉시
 * 동기화되려면 직접 알려야 한다. 둘 다 구독해야 "이 탭에서 눌러도, 저 탭에서 눌러도" 맞는다.
 */

const KEY = "instant-elements-pins";
const EVENT = "instant-elements-pins-changed";

export function getPins(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    // 프라이빗 모드·용량 초과 등 — 핀이 없는 것으로 보고 계속 동작한다.
    return [];
  }
}

export function isPinned(name: string): boolean {
  return getPins().includes(name);
}

/** 토글. 새로 고정한 것을 맨 앞에 넣어 최근 고정이 위로 오게 한다. */
export function togglePin(name: string): boolean {
  const current = getPins();
  const wasPinned = current.includes(name);
  const next = wasPinned ? current.filter((k) => k !== name) : [name, ...current];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패가 토글 자체를 막지는 않는다 */
  }
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* window 부재 환경 무시 */
  }
  return !wasPinned;
}

/** 핀 목록 구독 — 이 문서의 토글과 다른 탭의 변경에 모두 반응한다. */
export function usePins(): string[] {
  const [pins, setPins] = useState<string[]>(getPins);

  useEffect(() => {
    const sync = () => setPins(getPins());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return pins;
}

/** 고정된 것을 앞으로, 고정 순서를 유지해 가른다. */
export function partitionByPin<T>(
  items: T[],
  pins: string[],
  nameOf: (item: T) => string,
): { pinned: T[]; rest: T[] } {
  const order = new Map(pins.map((name, index) => [name, index]));
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (order.has(nameOf(item))) pinned.push(item);
    else rest.push(item);
  }
  pinned.sort((a, b) => (order.get(nameOf(a)) ?? 0) - (order.get(nameOf(b)) ?? 0));
  return { pinned, rest };
}
