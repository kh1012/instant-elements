import { useState } from "react";
import { createPage, fetchPages } from "../lib/api";
import { relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { Link, navigate } from "../router";
import { PageThumb } from "../page/PageThumb";
import { Button } from "../components/Button";
import { CardSkeleton } from "../components/CardSkeleton";
import { CreateDialog } from "../components/CreateDialog";

export function PagesRoute() {
  const state = useAsync(fetchPages, []);
  const [creating, setCreating] = useState(false);

  const create = async (title: string): Promise<void> => {
    const { slug } = await createPage(title);
    // 서버가 정한 slug 로 간다 — 제목이 겹치면 뒤에 숫자가 붙으므로 짐작하면 남의 페이지로 간다.
    navigate(`/pages/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-step-2 font-semibold">페이지</h1>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            쌓인 컴포넌트로 조립한 화면입니다. 열어서 보고, 고칠 자리를 짚어 두면 에이전트가 반영합니다.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          새 페이지
        </Button>
      </div>

      {state.status === "loading" ? (
        <CardSkeleton className="mt-8" count={6} />
      ) : state.status === "error" ? (
        <p className="mt-8 text-step-n1 text-st-destructive">{state.error}</p>
      ) : state.value.pages.length === 0 ? (
        <div className="anim-fade-up mt-8 rounded-lg border border-dashed border-st-border p-12 text-center">
          <p className="text-step-0 font-medium">아직 페이지가 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            빈 페이지를 만들어 두면 에이전트에게 무엇을 놓을지 설명할 수 있습니다.
          </p>
          {/*
            예전에는 여기서 `ie page create` 를 복사해 터미널로 나가라고 안내했다. 만들기가
            화면 안에 생긴 지금 그 안내는 더 먼 길을 가리킨다 — 같은 일을 하는 버튼을 둔다.
          */}
          <Button className="mt-5" variant="primary" onClick={() => setCreating(true)}>
            첫 페이지 만들기
          </Button>
        </div>
      ) : (
        <ul className="anim-fade-up mt-8 grid gap-3 sm:grid-cols-2">
          {state.value.pages.map((page) => (
            <li key={page.slug}>
              <Link
                to={`/pages/${encodeURIComponent(page.slug)}`}
                className="press relative flex flex-col gap-2.5 rounded-lg border border-st-border bg-st-card p-4 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* 미결 피드백 건수 — 목록에서 무엇부터 열지 정하는 신호다. */}
                {page.feedback > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-st-warning px-1 text-step-n2 font-medium text-st-background"
                    title={`반영되지 않은 피드백 ${page.feedback}건`}
                  >
                    {page.feedback}
                  </span>
                ) : null}

                <PageThumb nodes={page.preview} />

                <div className="flex flex-col gap-1">
                  <span className="text-step-0 font-medium">{page.title || page.slug}</span>
                  <span className="text-step-n2 text-st-muted-foreground">
                    v{page.version} · 최상위 {page.nodes}개 · {page.updatedBy || "알 수 없음"}
                    {page.updatedAt ? ` · ${relativeTime(page.updatedAt)}` : ""}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="새 페이지"
        description="빈 페이지가 만들어집니다. 무엇을 놓을지는 만든 뒤에 정합니다."
        label="제목"
        placeholder="예: 대시보드"
        submitLabel="만들기"
        onSubmit={create}
      />
    </div>
  );
}
