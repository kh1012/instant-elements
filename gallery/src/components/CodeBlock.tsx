import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { CopyButton } from "./CopyButton";

/**
 * 경량 신택스 하이라이터 — 외부 의존 0.
 *
 * shiki 같은 정식 하이라이터는 수백 KB 를 dev 서버에 얹는다. 갤러리가 보여주는 건 import 문과
 * 짧은 JSX 스니펫뿐이라, 문자열·주석·태그·PascalCase·숫자·키워드만 잡는 정규식으로 충분하다.
 * 정확도가 아니라 **읽기 편함**이 목적이다.
 */

const KEYWORDS =
  /\b(import|from|export|default|const|let|var|function|return|type|interface|as|new|await|async)\b/;

type Token = { text: string; kind: string };

/** 문자열·주석을 먼저 통째로 떼어낸다 — 그 안의 내용은 다른 규칙으로 쪼개면 안 된다. */
const SPANS = [
  { kind: "tok-com", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
  { kind: "tok-str", re: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/ },
];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let rest = source;

  while (rest.length > 0) {
    let best: { index: number; kind: string; text: string } | null = null;
    for (const span of SPANS) {
      const match = span.re.exec(rest);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, kind: span.kind, text: match[0] };
      }
    }
    if (!best) {
      tokens.push(...tokenizePlain(rest));
      break;
    }
    if (best.index > 0) tokens.push(...tokenizePlain(rest.slice(0, best.index)));
    tokens.push({ text: best.text, kind: best.kind });
    rest = rest.slice(best.index + best.text.length);
  }
  return tokens;
}

function tokenizePlain(source: string): Token[] {
  const tokens: Token[] = [];
  // 단어·숫자·JSX 태그 경계로 쪼갠다. 나머지는 그대로 흘린다.
  const parts = source.split(/(\b[A-Za-z_$][\w$]*\b|\d+(?:\.\d+)?|<\/?|\/?>)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part === "<" || part === "</" || part === ">" || part === "/>") {
      tokens.push({ text: part, kind: "tok-tag" });
    } else if (KEYWORDS.test(part)) {
      tokens.push({ text: part, kind: "tok-kw" });
    } else if (/^[A-Z][\w$]*$/.test(part)) {
      tokens.push({ text: part, kind: "tok-comp" });
    } else if (/^\d/.test(part)) {
      tokens.push({ text: part, kind: "tok-num" });
    } else {
      tokens.push({ text: part, kind: "" });
    }
  }
  return tokens;
}

function highlight(source: string): ReactNode[] {
  return tokenize(source).map((token, index) =>
    token.kind ? (
      // eslint-disable-next-line react/no-array-index-key -- 토큰 배열은 소스가 같으면 항상 같다.
      <span key={index} className={token.kind}>
        {token.text}
      </span>
    ) : (
      <span key={index}>{token.text}</span>
    ),
  );
}

export function CodeBlock({
  code,
  className,
  copyable = true,
}: {
  code: string;
  className?: string;
  copyable?: boolean;
}) {
  return (
    <div className={cn("group relative", className)}>
      <pre className="overflow-x-auto rounded-lg border border-st-border bg-st-muted p-4 text-step-n2">
        <code className="font-mono">{highlight(code)}</code>
      </pre>
      {copyable ? (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton text={code} size="sm" />
        </div>
      ) : null}
    </div>
  );
}
