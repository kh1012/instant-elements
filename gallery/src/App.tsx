import { AppHeader, type Section } from "./components/AppHeader";
import { CommandPalette } from "./components/CommandPalette";
import { DetailRoute } from "./routes/DetailRoute";
import { FlowRoute } from "./routes/FlowRoute";
import { FlowsRoute } from "./routes/FlowsRoute";
import { LibraryRoute } from "./routes/LibraryRoute";
import { PageRoute } from "./routes/PageRoute";
import { PagesRoute } from "./routes/PagesRoute";
import { safeDecode, usePath } from "./router";

export function App() {
  const path = usePath();

  const detail = /^\/c\/(.+)$/.exec(path);
  const page = /^\/pages\/(.+)$/.exec(path);
  const flow = /^\/flows\/(.+)$/.exec(path);

  // 활성 네비는 라우트 정규식이 아니라 이 한 값으로 결정한다 — 라우트가 늘 때마다
  // 헤더의 조건식을 함께 고치면 반드시 어긋난다.
  const section: Section = path.startsWith("/pages")
    ? "pages"
    : path.startsWith("/flows")
      ? "flows"
      : "library";

  return (
    <div className="min-h-full bg-st-background text-st-foreground">
      <AppHeader active={section} />
      <CommandPalette />

      <main key={path} className="anim-fade-in">
        {detail?.[1] ? (
          <DetailRoute name={safeDecode(detail[1])} />
        ) : page?.[1] ? (
          <PageRoute slug={safeDecode(page[1])} />
        ) : flow?.[1] ? (
          <FlowRoute slug={safeDecode(flow[1])} />
        ) : section === "pages" ? (
          <PagesRoute />
        ) : section === "flows" ? (
          <FlowsRoute />
        ) : (
          <LibraryRoute />
        )}
      </main>
    </div>
  );
}
