import type { ReactNode } from "react";
import type { ElementStatus, Entry } from "instant-elements/registry";
import { CategoryBadge } from "../components/StatusBadge";
import { formatAt } from "../lib/format";
import { componentNameOf, importPathFor, type PromptContext } from "../lib/prompt";
import { Link } from "../router";
import { StatusControl } from "./DetailRoute.status-control";

/**
 * 정보 패널.
 *
 * ── 값이 없어도 행을 지우지 않는다
 * 예전에는 비면 행 자체를 없앴다. 그러면 "이 컴포넌트는 토큰을 안 쓰나?"와 "토큰 정보를 아직
 * 안 적었나?"를 구분할 수 없다. 둘은 다른 문제고, 다른 행동을 부른다. 그래서 **"없음"이라고
 * 적는다** — 비어 있음도 정보다.
 *
 * 다만 정말 해당 없는 것(출처)만 예외로 감춘다. 밖에서 안 가져온 컴포넌트에 "출처: 없음"은
 * 채울 수 없는 빈칸을 만들어 놓는 것이다.
 */
export function DetailPropsPanel({
  entry,
  ctx,
  usedBy,
  running,
  onStatusChanged,
}: {
  entry: Entry;
  ctx: PromptContext;
  usedBy: Entry[];
  running: boolean;
  onStatusChanged: (next: ElementStatus) => void;
}) {
  const props = entry.meta.props?.filter((p) => p.editable !== false) ?? [];

  return (
    <aside>
      <dl className="divide-y divide-st-border rounded-xl border border-st-border bg-st-card px-4">
        <Row label="상태">
          <span className="font-medium">{entry.meta.status}</span>
          <StatusControl
            name={entry.name}
            status={entry.meta.status}
            running={running}
            onChanged={onStatusChanged}
          />
        </Row>

        <Row label="분류">
          <CategoryBadge category={entry.meta.category} />
        </Row>

        <Row label="import">
          <code className="break-all font-mono text-step-n2">{importPathFor(entry, ctx)}</code>
        </Row>

        <Row label="export">
          <code className="font-mono text-step-n2">{componentNameOf(entry)}</code>
        </Row>

        <Row label="코드">
          <code className="break-all font-mono text-step-n2">{entry.files[0]?.path ?? "없음"}</code>
        </Row>

        <Row label="역할">{entry.meta.intent}</Row>

        <Row label="props">
          {props.length === 0 ? (
            <Empty />
          ) : (
            <span className="flex flex-col gap-0.5">
              {props.map((prop) => (
                <code key={prop.name} className="font-mono text-step-n2">
                  <span className="text-st-foreground">{prop.name}</span>
                  <span className="text-st-muted-foreground">: </span>
                  <span className="text-[var(--tok-kw)]">{prop.type}</span>
                  {prop.type === "enum" && prop.options?.length ? (
                    <span className="text-st-muted-foreground">
                      (
                      <span className="text-[var(--tok-str)]">{prop.options.join(" | ")}</span>)
                    </span>
                  ) : null}
                </code>
              ))}
            </span>
          )}
        </Row>

        <Row label="구성">
          {entry.meta.composedOf?.length ? (
            <Chips names={entry.meta.composedOf} />
          ) : (
            <span className="text-step-n2 text-st-muted-foreground">단일 컴포넌트</span>
          )}
        </Row>

        <Row label="쓰이는 곳">
          {usedBy.length > 0 ? <Chips names={usedBy.map((e) => e.name)} /> : <Empty />}
        </Row>

        <Row label="토큰">
          {entry.meta.tokens?.length ? (
            <span className="flex flex-wrap gap-1">
              {entry.meta.tokens.map((token) => (
                <span
                  key={token}
                  className="rounded-full bg-st-muted px-2 py-0.5 font-mono text-step-n2 text-st-muted-foreground"
                >
                  {token}
                </span>
              ))}
            </span>
          ) : (
            <Empty />
          )}
        </Row>

        <Row label="검색어">
          {entry.meta.keywords.length ? (
            <span className="text-step-n2">{entry.meta.keywords.join(", ")}</span>
          ) : (
            <Empty />
          )}
        </Row>

        <Row label="만든이">
          {entry.meta.createdBy} · {formatAt(entry.meta.createdAt)}
        </Row>

        {/* 밖에서 가져온 것이면 크레딧을 남긴다 — 이 자리에 없으면 출처가 히스토리에만 묻힌다. */}
        {entry.meta.origin ? (
          <Row label="출처">
            <span className="flex flex-col gap-0.5">
              <span>
                {entry.meta.origin.publishedBy ? `@${entry.meta.origin.publishedBy}` : "마켓플레이스"}
                {entry.meta.origin.publishedAt
                  ? ` · ${formatAt(entry.meta.origin.publishedAt)} 발행`
                  : ""}
              </span>
              <a
                href={entry.meta.origin.source}
                target="_blank"
                rel="noreferrer noopener"
                className="press break-all text-step-n2 text-st-muted-foreground underline hover:text-st-foreground"
              >
                {entry.meta.origin.source}
              </a>
            </span>
          </Row>
        ) : null}
      </dl>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <dt className="text-step-n2 text-st-muted-foreground">{label}</dt>
      <dd className="break-words text-step-n1">{children}</dd>
    </div>
  );
}

function Empty() {
  return <span className="text-step-n2 text-st-muted-foreground">없음</span>;
}

function Chips({ names }: { names: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {names.map((name) => (
        <Link
          key={name}
          to={`/c/${name}`}
          className="press rounded-full bg-st-muted px-2 py-0.5 text-step-n2 hover:bg-st-interactive-muted-hover-bg"
        >
          {name}
        </Link>
      ))}
    </span>
  );
}
