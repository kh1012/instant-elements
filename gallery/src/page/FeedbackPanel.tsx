import { useState } from "react";
import entries from "virtual:ie/entries";
import type { PageHistoryEvent, PageNode } from "instant-elements/page";
import { Button } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/format";
import { buildFeedbackPrompt } from "../lib/page-feedback-prompt";
import type { FeedbackItem, PageDetail } from "../lib/api";

type Tab = "feedback" | "history";

const ACTION_LABEL: Record<PageHistoryEvent["action"], string> = {
  created: "생성",
  edited: "편집",
  refined: "고도화",
  restored: "복원",
};

/**
 * 리뷰 사이드 패널.
 *
 * **피드백**과 **히스토리**를 탭으로 가른다 — 둘은 성격이 다르다. 피드백은 "앞으로 이렇게
 * 해달라"는 미결 목록이고, 히스토리는 "이미 이렇게 됐다"는 기록이다. 한 칸에 섞으면 무엇이
 * 남은 일인지 읽히지 않는다.
 *
 * _근거: 상류 하네스 51c4a0b6e · 9ff4762d4._
 */
export function FeedbackPanel({
  page,
  items,
  target,
  importAlias,
  onSubmit,
  onDelete,
  onClearAll,
  onClearTarget,
}: {
  page: PageDetail;
  items: FeedbackItem[];
  /** 지금 지목 중인 노드. 없으면 페이지 전체에 대한 코멘트가 된다. */
  target: PageNode | null;
  importAlias: string;
  onSubmit: (input: { comment: string; components: string[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onClearTarget: () => void;
}) {
  const [tab, setTab] = useState<Tab>("feedback");
  const [comment, setComment] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!comment.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({ comment: comment.trim(), components: picked });
      setComment("");
      setPicked([]);
    } finally {
      setBusy(false);
    }
  };

  const prompt = buildFeedbackPrompt(page, items, entries, importAlias);

  return (
    <aside className="flex w-96 shrink-0 flex-col gap-3">
      <div className="flex items-center gap-1 rounded-md bg-st-muted p-0.5">
        {(["feedback", "history"] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "press flex-1 rounded-sm px-2.5 py-1 text-step-n2",
              tab === value
                ? "bg-st-card text-st-foreground shadow-sm"
                : "text-st-muted-foreground hover:text-st-foreground",
            )}
          >
            {value === "feedback" ? `피드백 ${items.length}` : `히스토리 ${page.history.length}`}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <ol className="flex flex-col gap-2">
          {page.history.map((event, index) => (
            <li
              key={`${event.at}-${index}`}
              className="rounded-lg border border-st-border bg-st-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-step-n2">
                <span className="font-medium">{ACTION_LABEL[event.action]}</span>
                <span className="text-st-muted-foreground">{event.actor}</span>
                <span className="text-st-muted-foreground">v{event.version}</span>
                <span className="text-st-muted-foreground">{relativeTime(event.at)}</span>
              </div>
              {event.note ? <p className="mt-1 text-step-n1">{event.note}</p> : null}
            </li>
          ))}
          {page.history.length === 0 ? (
            <p className="text-step-n1 text-st-muted-foreground">기록이 없습니다.</p>
          ) : null}
        </ol>
      ) : (
        <>
          {/* 작성기는 캔버스보다 **밝은 표면**에 둔다 — 배경에 묻히면 "여기에 쓰라"는 신호가 사라진다. */}
          <div className="rounded-lg border border-st-border bg-st-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-step-n2 font-medium">
                {target ? (
                  <>
                    {target.props._label ?? target.type}{" "}
                    <code className="text-st-muted-foreground">{target.props.id}</code>
                  </>
                ) : (
                  "페이지 전체"
                )}
              </span>
              {target ? (
                <Button size="sm" variant="ghost" onClick={onClearTarget}>
                  전체로
                </Button>
              ) : null}
            </div>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                // ⌘/Ctrl+Enter 로 제출 — 코멘트는 여러 줄일 수 있어 Enter 를 뺏으면 안 된다.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit();
              }}
              rows={3}
              placeholder={target ? "이 자리를 어떻게 고칠까요?" : "페이지 전체에 대한 의견"}
              className="mt-2 w-full resize-y rounded-md border border-st-border bg-st-background px-2.5 py-2 text-step-n1 placeholder:text-st-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring"
            />

            <details className="mt-2">
              <summary className="cursor-pointer text-step-n2 text-st-muted-foreground">
                이 자리에 놓을 컴포넌트 지목 {picked.length > 0 ? `(${picked.length})` : ""}
              </summary>
              <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
                {entries.map((entry) => (
                  <button
                    key={entry.name}
                    type="button"
                    onClick={() =>
                      setPicked((prev) =>
                        prev.includes(entry.name)
                          ? prev.filter((n) => n !== entry.name)
                          : [...prev, entry.name],
                      )
                    }
                    className={cn(
                      "press rounded-sm px-1.5 py-0.5 text-step-n2",
                      picked.includes(entry.name)
                        ? "bg-st-primary text-st-primary-foreground"
                        : "bg-st-muted text-st-muted-foreground hover:bg-st-interactive-muted-hover-bg",
                    )}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            </details>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-step-n2 text-st-muted-foreground">⌘↵ 로 등록</span>
              <Button variant="primary" size="sm" onClick={() => void submit()} disabled={busy || !comment.trim()}>
                피드백 남기기
              </Button>
            </div>
          </div>

          {items.length > 0 ? (
            <>
              <ul className="flex flex-col gap-2">
                {items.map((item, index) => (
                  <li key={item.id} className="rounded-lg border border-st-border bg-st-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-step-n2 text-st-muted-foreground">
                        {index + 1}. {item.nodeId ? (item.nodeType ?? "요소") : "페이지 전체"}
                        {item.nodeId ? <code className="ml-1">{item.nodeId}</code> : null}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => void onDelete(item.id)}>
                        삭제
                      </Button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-step-n1">{item.comment}</p>
                    {item.components?.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.components.map((name) => (
                          <span
                            key={name}
                            className="rounded-sm bg-st-muted px-1.5 py-0.5 text-step-n2 text-st-muted-foreground"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-1 text-step-n2 text-st-muted-foreground">
                      {item.actor} · {relativeTime(item.at)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2">
                <CopyButton
                  variant="primary"
                  className="flex-1"
                  label={`반영 프롬프트 복사 (${items.length}건)`}
                  text={prompt}
                />
                <Button size="md" onClick={() => void onClearAll()}>
                  비우기
                </Button>
              </div>
            </>
          ) : (
            <p className="text-step-n1 text-st-muted-foreground">
              미리보기에서 고칠 자리를 클릭한 뒤 의견을 남기세요. 모아서 한 번에 프롬프트로
              넘깁니다.
            </p>
          )}
        </>
      )}
    </aside>
  );
}
