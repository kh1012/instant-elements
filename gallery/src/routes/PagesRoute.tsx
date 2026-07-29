import { fetchPages } from "../lib/api";
import { relativeTime } from "../lib/format";
import { useAsync } from "../lib/useAsync";
import { Link } from "../router";

export function PagesRoute() {
  const state = useAsync(fetchPages, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-step-2 font-semibold">페이지</h1>
      <p className="mt-2 text-step-n1 text-st-muted-foreground">
        쌓인 컴포넌트로 조립한 화면입니다. 열어서 보고, 고칠 자리를 짚어 두면 에이전트가 반영합니다.
      </p>

      {state.status === "loading" ? (
        <p className="mt-8 text-step-n1 text-st-muted-foreground">불러오는 중…</p>
      ) : state.status === "error" ? (
        <p className="mt-8 text-step-n1 text-st-destructive">{state.error}</p>
      ) : state.value.pages.length === 0 ? (
        <div className="anim-fade-up mt-8 rounded-lg border border-dashed border-st-border p-12 text-center">
          <p className="text-step-0 font-medium">아직 페이지가 없습니다.</p>
          <p className="mt-2 text-step-n1 text-st-muted-foreground">
            에이전트에게 원하는 화면을 설명하거나, 직접 만들어 보세요.
          </p>
          <pre className="mx-auto mt-4 w-fit rounded-md bg-st-muted px-3 py-2 text-step-n2 font-mono">
            ie page create &quot;대시보드&quot;
          </pre>
        </div>
      ) : (
        <ul className="anim-fade-up mt-8 grid gap-3 sm:grid-cols-2">
          {state.value.pages.map((page) => (
            <li key={page.slug}>
              <Link
                to={`/pages/${encodeURIComponent(page.slug)}`}
                className="press flex flex-col gap-1.5 rounded-lg border border-st-border bg-st-card p-4 hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="text-step-0 font-medium">{page.title || page.slug}</span>
                <span className="text-step-n2 text-st-muted-foreground">
                  v{page.version} · 최상위 {page.nodes}개 · {page.updatedBy || "알 수 없음"}
                  {page.updatedAt ? ` · ${relativeTime(page.updatedAt)}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
