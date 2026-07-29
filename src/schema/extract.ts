import type { PropSchema, PropType } from "../registry/schema.js";

/**
 * TypeScript Props 타입에서 props 스키마를 뽑는다.
 *
 * ── 왜 손으로 파싱하나
 * TypeScript 컴파일러 API 를 쓰면 정확하지만, 그 순간 이 CLI 가 소비 프로젝트의 tsconfig·경로
 * 별칭·타입 의존을 전부 해석할 수 있어야 한다(그리고 7MB 짜리 런타임 의존이 붙는다). 우리가
 * 필요한 건 **한 파일 안에 선언된 Props 인터페이스의 표면**뿐이라, 그 범위에서는 구문 파싱으로 충분하다.
 *
 * 해석하지 못한 타입은 조용히 넘기지 않고 `unknown` 으로 남긴다 — 잘못 추측한 스키마는 없느니만
 * 못하다. 페이지 조립이 그걸 믿고 값을 넘기기 때문이다.
 */

export interface ExtractedProp extends PropSchema {
  /** 원본 타입 문자열(진단·검토용). */
  raw: string;
}

/** 화면에서 값을 바꿀 이유가 없는 prop — 편집 표면에서 감춘다. */
const NON_EDITABLE = new Set(["className", "style", "children", "ref", "key", "id"]);

/** 액션으로 볼 prop 이름 관례. 타입이 함수면 이름과 무관하게 액션이지만, 이건 보조 신호다. */
const ACTION_PREFIX = /^on[A-Z]/;

/**
 * `export interface FooProps { … }` 또는 `export type FooProps = { … }` 본문을 떼어낸다.
 * 중괄호 깊이를 세므로 중첩 객체 타입이 있어도 끝을 정확히 찾는다.
 */
export function findPropsBody(source: string, exportName?: string): string | null {
  const names = exportName ? [`${exportName}Props`] : [];
  const pattern = names.length
    ? new RegExp(`(?:interface|type)\\s+(${names.join("|")})\\s*(?:=\\s*)?\\{`)
    : /(?:interface|type)\s+(\w*Props)\s*(?:=\s*)?\{/;

  const match = pattern.exec(source);
  if (!match) return null;

  const open = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** 한 줄(또는 여러 줄) 멤버 선언을 잘라낸다. 중첩 객체·유니온 안의 세미콜론에 속지 않는다. */
function splitMembers(body: string): { doc: string; text: string }[] {
  const members: { doc: string; text: string }[] = [];
  let depth = 0;
  let current = "";
  let doc = "";
  let pendingDoc = "";

  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    // 멤버가 아직 시작되지 않은 상태 — 빈 줄과 주석은 흘려보낸다.
    // `current === ""` 가 아니라 `current.trim() === ""` 으로 판정해야 한다. 본문 첫 줄이 개행이라
    // current 가 "\n" 이 되는 순간 빈 상태 판정이 영원히 거짓이 되고, JSDoc 라벨이 통째로 사라진다.
    if (depth === 0 && current.trim() === "") {
      const jsdoc = /^\/\*\*\s*(.*?)\s*\*\/$/.exec(trimmed);
      if (jsdoc) {
        pendingDoc = jsdoc[1] ?? "";
        continue;
      }
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        continue;
      }
      doc = pendingDoc;
    }
    current += `${line}\n`;
    for (const char of line) {
      if (char === "{" || char === "(" || char === "[" || char === "<") depth += 1;
      else if (char === "}" || char === ")" || char === "]" || char === ">") depth -= 1;
    }

    if (depth <= 0 && /[;,]\s*$/.test(trimmed)) {
      members.push({ doc, text: current.trim() });
      current = "";
      pendingDoc = "";
      doc = "";
      depth = 0;
    }
  }
  if (current.trim()) members.push({ doc, text: current.trim() });
  return members;
}

/** 유니온 리터럴(`"a" | "b"`)이면 옵션 배열을, 아니면 null. */
function enumOptions(type: string): string[] | null {
  const parts = type.split("|").map((p) => p.trim());
  if (parts.length < 2) return null;
  const options: string[] = [];
  for (const part of parts) {
    const literal = /^["'](.*)["']$/.exec(part);
    if (!literal) return null;
    options.push(literal[1] ?? "");
  }
  return options;
}

export function classifyType(type: string): { type: PropType; options?: string[] } {
  const clean = type.replace(/\s+/g, " ").trim().replace(/;$/, "");

  // 함수 시그니처면 동작이다. 이 판정이 먼저다 — 흐름이 여기 붙는다.
  if (/=>/.test(clean) || /^\(.*\)\s*:/.test(clean)) return { type: "action" };

  const options = enumOptions(clean);
  if (options) return { type: "enum", options };

  if (/^(string)$/.test(clean)) return { type: "string" };
  if (/^(number)$/.test(clean)) return { type: "number" };
  if (/^(boolean|true|false)$/.test(clean)) return { type: "boolean" };
  if (/\[\]$/.test(clean) || /^(Array|ReadonlyArray)</.test(clean)) return { type: "array" };
  if (/^(ReactNode|ReactElement|JSX\.Element|ReactChild)/.test(clean)) return { type: "node" };
  if (/^\{/.test(clean) || /^Record</.test(clean)) return { type: "object" };

  // 해석 못 한 타입 — 추측하지 않는다.
  return { type: "object" };
}

export interface ExtractResult {
  props: ExtractedProp[];
  /** Props 타입을 찾지 못했으면 그 사실을 알린다(빈 배열과 구분). */
  found: boolean;
}

export function extractProps(source: string, exportName?: string): ExtractResult {
  const body = findPropsBody(source, exportName) ?? findPropsBody(source);
  if (body === null) return { props: [], found: false };

  const props: ExtractedProp[] = [];
  for (const member of splitMembers(body)) {
    // `name?: type;` · `"quoted-name": type;` · 인덱스 시그니처 제외
    const match = /^\[?["']?([A-Za-z_$][\w$]*)["']?\]?(\?)?\s*:\s*([\s\S]+?)[;,]?$/.exec(member.text);
    if (!match) continue;
    const name = match[1] as string;
    if (member.text.startsWith("[")) continue; // 인덱스 시그니처

    const optional = match[2] === "?";
    const raw = (match[3] ?? "").trim();
    const { type, options } = classifyType(raw);

    const prop: ExtractedProp = {
      name,
      type: ACTION_PREFIX.test(name) && type !== "action" ? "action" : type,
      required: !optional,
      editable: !NON_EDITABLE.has(name),
      raw,
    };
    if (options) prop.options = options;
    if (member.doc) prop.label = member.doc;
    props.push(prop);
  }

  return { props, found: true };
}

/** 엔트리에 저장할 형태(진단용 `raw` 제거). */
export function toEntryProps(props: ExtractedProp[]): PropSchema[] {
  return props.map(({ raw: _raw, ...rest }) => rest);
}

/** 두 스키마가 같은지 — `--check` 가 드리프트를 잡는 기준. */
export function propsEqual(a: PropSchema[] | undefined, b: PropSchema[]): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b);
}
