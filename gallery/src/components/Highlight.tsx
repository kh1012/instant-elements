import { splitByMatch } from "../lib/search";

/**
 * 검색어에 걸린 부분을 굵게 표시한다.
 *
 * "왜 이게 결과에 나왔나"를 답해 주는 장치다 — 이름이 아니라 설명이나 검색어에 걸려 나온
 * 경우 하이라이트가 없으면 오작동처럼 보인다.
 *
 * 색을 칠하지 않고 굵기와 밑줄만 쓴다. 카드 안에는 프리뷰가 있고, 거기에 색 강조가 끼면
 * 정작 봐야 할 컴포넌트의 색과 다툰다(갤러리 크롬 모노톤 원칙과 같은 이유).
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const parts = splitByMatch(text, query);
  if (parts.length === 1 && !parts[0]?.hit) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          // eslint-disable-next-line react/no-array-index-key -- 같은 입력이면 조각 배열이 항상 같다.
          <mark key={index} className="bg-transparent font-semibold text-st-foreground underline">
            {part.text}
          </mark>
        ) : (
          // eslint-disable-next-line react/no-array-index-key -- 위와 같은 이유.
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
