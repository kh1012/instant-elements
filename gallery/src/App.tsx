import galleryConfig from "virtual:ie/config";
import entries from "virtual:ie/entries";
import { Button } from "./components/Button";
import { cn } from "./lib/cn";
import { DetailRoute } from "./routes/DetailRoute";
import { LibraryRoute } from "./routes/LibraryRoute";
import { FlowRoute } from "./routes/FlowRoute";
import { FlowsRoute } from "./routes/FlowsRoute";
import { PageRoute } from "./routes/PageRoute";
import { PagesRoute } from "./routes/PagesRoute";
import { Link, safeDecode, usePath } from "./router";
import { useTheme } from "./theme";

const NAV = [
  { to: "/", label: "라이브러리", match: (path: string) => path === "/" || path.startsWith("/c/") },
  { to: "/pages", label: "페이지", match: (path: string) => path.startsWith("/pages") },
  { to: "/flows", label: "흐름", match: (path: string) => path.startsWith("/flows") },
];

export function App() {
  const { theme, toggle } = useTheme();
  const path = usePath();

  const detail = /^\/c\/(.+)$/.exec(path);
  const page = /^\/pages\/(.+)$/.exec(path);
  const flow = /^\/flows\/(.+)$/.exec(path);

  return (
    <div className="min-h-full bg-st-background text-st-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-st-border bg-st-background/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link to="/" className="press flex items-baseline gap-2.5">
            <span className="text-step-0 font-semibold">instant-elements</span>
            <span className="text-step-n2 text-st-muted-foreground">{galleryConfig.title}</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "press rounded-md px-2.5 py-1 text-step-n1",
                  item.match(path)
                    ? "bg-st-muted text-st-foreground"
                    : "text-st-muted-foreground hover:text-st-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-step-n2 text-st-muted-foreground">{entries.length}개</span>
          <Button size="sm" onClick={toggle}>
            {theme === "dark" ? "라이트" : "다크"}
          </Button>
        </div>
      </header>

      <main key={path} className="anim-fade-up">
        {detail?.[1] ? (
          <DetailRoute name={safeDecode(detail[1])} />
        ) : page?.[1] ? (
          <PageRoute slug={safeDecode(page[1])} />
        ) : flow?.[1] ? (
          <FlowRoute slug={safeDecode(flow[1])} />
        ) : path.startsWith("/pages") ? (
          <PagesRoute />
        ) : path.startsWith("/flows") ? (
          <FlowsRoute />
        ) : (
          <LibraryRoute />
        )}
      </main>
    </div>
  );
}
