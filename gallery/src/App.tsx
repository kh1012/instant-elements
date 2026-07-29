import galleryConfig from "virtual:ie/config";
import entries from "virtual:ie/entries";
import { Button } from "./components/Button";
import { DetailRoute } from "./routes/DetailRoute";
import { LibraryRoute } from "./routes/LibraryRoute";
import { Link, safeDecode, usePath } from "./router";
import { useTheme } from "./theme";

export function App() {
  const { theme, toggle } = useTheme();
  const path = usePath();
  const detail = /^\/c\/(.+)$/.exec(path);

  return (
    <div className="min-h-full bg-st-background text-st-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-st-border bg-st-background/90 px-6 py-3 backdrop-blur">
        <Link to="/" className="press flex items-baseline gap-2.5">
          <span className="text-step-0 font-semibold">instant-elements</span>
          <span className="text-step-n2 text-st-muted-foreground">{galleryConfig.title}</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-step-n2 text-st-muted-foreground">{entries.length}개</span>
          <Button size="sm" onClick={toggle}>
            {theme === "dark" ? "라이트" : "다크"}
          </Button>
        </div>
      </header>

      <main key={path} className="anim-fade-up">
        {detail?.[1] ? <DetailRoute name={safeDecode(detail[1])} /> : <LibraryRoute />}
      </main>
    </div>
  );
}
