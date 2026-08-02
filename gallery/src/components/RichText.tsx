import { Fragment, type ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

/** 코드 펜스가 들어 있는가 — 인용부호로 감쌀지 정하는 데 쓴다. */
export function hasCodeFence(text: string): boolean {
  return /^```/m.test(text);
}

/**
 * 히스토리에 남은 글을 읽을 수 있게 그린다.
 *
 * 요청 원문에는 코드가 자주 섞인다("이 props 를 이렇게 바꿔줘" + 스니펫). 그걸 평문 blockquote 로
 * 흘리면 들여쓰기가 무너지고 줄바꿈이 붙어 **무엇을 부탁했는지 다시 읽을 수 없다.** 기록의
 * 가치는 나중에 읽힐 때 생기므로, 펜스는 코드블록으로 URL 은 링크로 승격한다.
 *
 * 마크다운 전체를 파싱하지 않는다 — 라이브러리를 들이지 않고도 이 둘이면 실제 요청문의 가독성
 * 문제는 거의 사라진다. 볼드·리스트까지 지원하려다 반쪽짜리 파서를 들이는 쪽이 더 나쁘다.
 */
export function RichText({ text }: { text: string }) {
  // 펜스를 기준으로 자른다. 홀수 인덱스가 코드다(여는 펜스와 닫는 펜스 사이).
  const parts = text.split(/^```[^\n]*\n?([\s\S]*?)^```$/gm);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        if (index % 2 === 1) {
          return <CodeBlock key={index} code={part.replace(/\n$/, "")} className="my-2" />;
        }
        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            {linkify(part)}
          </p>
        );
      })}
    </>
  );
}

/**
 * URL 을 앵커로.
 *
 * 뒤에 붙은 구두점은 주소에서 뺀다 — "…자세히는 https://example.com/a 를 보세요." 에서 마침표나
 * 조사가 URL 에 딸려 들어가면 링크가 깨진다.
 */
function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /https?:\/\/[^\s<>]+/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.replace(/[.,)\]}>'"’”·]+$/, "");
    if (match.index > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, match.index)}</Fragment>);
    out.push(
      <a
        key={`a${match.index}`}
        href={trimmed}
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 hover:text-st-foreground"
      >
        {trimmed}
      </a>,
    );
    // 잘라 낸 구두점은 본문으로 되돌린다.
    if (trimmed.length < raw.length) out.push(<Fragment key={`p${match.index}`}>{raw.slice(trimmed.length)}</Fragment>);
    last = match.index + raw.length;
  }

  if (last < text.length) out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return out;
}
