import entries from "virtual:ie/entries";
import galleryConfig from "virtual:ie/config";
import { useTheme } from "./theme";

/**
 * 갤러리 셸.
 *
 * 지금은 레지스트리가 실제로 연결됐는지를 보여주는 최소 화면이다 — 라이브러리 목록과 상세는
 * 다음 단계에서 이 셸 안으로 들어온다.
 */
export function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-full bg-st-background text-st-foreground">
      <header className="flex items-center justify-between border-b border-st-border px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-step-1 font-semibold">instant-elements</span>
          <span className="text-step-n1 text-st-muted-foreground">{galleryConfig.title}</span>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="press rounded-md border border-st-border bg-st-card px-3 py-1.5 text-step-n1 hover:bg-st-interactive-muted-hover-bg"
        >
          {theme === "dark" ? "라이트" : "다크"}
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-step-2 font-semibold">라이브러리</h1>
        <p className="mt-2 text-step-n1 text-st-muted-foreground">
          {entries.length}개 컴포넌트 · import 별칭 <code>{galleryConfig.importAlias}</code>
        </p>

        {entries.length === 0 ? (
          <div className="anim-fade-up mt-8 rounded-lg border border-dashed border-st-border p-10 text-center">
            <p className="text-step-0 font-medium">아직 컴포넌트가 없습니다.</p>
            <p className="mt-2 text-step-n1 text-st-muted-foreground">
              <code>ie element new &lt;name&gt; --intent … --summary …</code> 로 첫 컴포넌트를
              만들어 보세요.
            </p>
          </div>
        ) : (
          <ul className="anim-fade-up mt-8 grid gap-3">
            {entries.map((entry) => (
              <li
                key={entry.name}
                className="press rounded-lg border border-st-border bg-st-card p-4"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-step-0 font-medium">{entry.name}</span>
                  <span className="rounded-sm bg-st-muted px-1.5 py-0.5 text-step-n2 text-st-muted-foreground">
                    {entry.meta.category}
                  </span>
                  <span className="text-step-n2 text-st-muted-foreground">{entry.meta.status}</span>
                </div>
                <p className="mt-1 text-step-n1 text-st-muted-foreground">{entry.meta.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
