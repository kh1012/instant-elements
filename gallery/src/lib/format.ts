/** ISO 시각을 사람이 읽는 문자열로. 자정 저장(날짜만 아는 경우)은 시각을 감춘다. */
export function formatAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;

  // 정확히 자정이면 날짜만 알고 시각은 모르는 기록이다 — 00:00 을 보여주면 사실이 아닌 정밀도를 주장하게 된다.
  if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) return ymd;
  return `${ymd} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const diff = Math.max(0, now - at);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "방금";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}일 전`;
  return formatAt(iso);
}
