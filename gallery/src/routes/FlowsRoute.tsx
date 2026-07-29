import { relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { Link } from "../router";

interface FlowSummary {
  slug: string;
  name: string;
  screens: number;
  edges: number;
  updatedAt: string;
}

export function FlowsRoute() {
  const state = useAsync(
    () => fetch("/api/flows").then((r) => r.json() as Promise<{ flows: FlowSummary[] }>),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-step-2 font-semibold">흐름</h1>
      <p className="mt-2 text-step-n1 text-st-muted-foreground">
        만든 페이지를 이어 붙여 실제 서비스처럼 화면을 넘기며 시연합니다.
      </p>

      {state.status === "loading" ? (
        <p className="mt-8 text-step-n1 text-st-muted-foreground">불러오는 중…</p>
      ) : state.status === "error" ? (
        <p className="mt-8 text-step-n1 text-st-destructive">{state.error}</p>
      ) : state.value.flows.length === 0 ? (
        <div className="anim-fade-up mt-8 rounded-lg border border-dashed border-st-border p-12 text-center">
          <p className="text-step-0 font-medium">아직 흐름이 없습니다.</p>
          <pre className="mx-auto mt-4 w-fit rounded-md bg-st-muted px-3 py-2 text-step-n2 font-mono">
            ie flow create &quot;온보딩&quot;
          </pre>
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
    </div>
  );
}
