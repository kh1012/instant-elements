import { useState } from "react";
import { createFlow, fetchFlows } from "../lib/api";
import { relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { Link, navigate } from "../router";
import { Button } from "../components/Button";
import { CardSkeleton } from "../components/CardSkeleton";
import { CreateDialog } from "../components/CreateDialog";

export function FlowsRoute() {
  const state = useAsync(fetchFlows, []);
  const [creating, setCreating] = useState(false);

  const create = async (name: string): Promise<void> => {
    const { slug } = await createFlow(name);
    navigate(`/flows/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-step-2 font-semibold">흐름</h1>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            만든 페이지를 이어 붙여 실제 서비스처럼 화면을 넘기며 시연합니다.
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          새 흐름
        </Button>
      </div>

      {state.status === "loading" ? (
        <CardSkeleton className="mt-8" count={3} />
      ) : state.status === "error" ? (
        <p className="mt-8 text-step-n1 text-st-destructive">{state.error}</p>
      ) : state.value.flows.length === 0 ? (
        <div className="anim-fade-up mt-8 rounded-lg border border-dashed border-st-border p-12 text-center">
          <p className="text-step-0 font-medium">아직 흐름이 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            빈 흐름을 만든 뒤, 페이지를 화면으로 얹고 이어 붙입니다.
          </p>
          <Button className="mt-5" variant="primary" onClick={() => setCreating(true)}>
            첫 흐름 만들기
          </Button>
        </div>
      ) : (
        <ul className="anim-fade-up mt-8 grid gap-3 sm:grid-cols-2">
          {state.value.flows.map((flow) => (
            <li key={flow.slug}>
              <Link
                to={`/flows/${encodeURIComponent(flow.slug)}`}
                className="press flex flex-col gap-1.5 rounded-lg border border-st-border bg-st-card p-4 hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="text-step-0 font-medium">{flow.name}</span>
                <span className="text-step-n2 text-st-muted-foreground">
                  화면 {flow.screens}개 · 연결 {flow.edges}개
                  {flow.updatedAt ? ` · ${relativeTime(flow.updatedAt)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        title="새 흐름"
        description="빈 흐름이 만들어집니다. 화면은 만든 뒤에 얹습니다."
        label="이름"
        placeholder="예: 온보딩"
        submitLabel="만들기"
        onSubmit={create}
      />
    </div>
  );
}
