import { useState } from "react";
import { Button } from "../components/Button";
import { fetchPages, setFlowScreen, type PageSummary } from "../lib/api";
import { useAsync } from "../lib/useAsync";

/**
 * 화면이 하나도 없는 흐름의 빈 상태.
 *
 * 예전에는 여기에 "이 화면의 내용을 불러오지 못했습니다."가 떴다. 화면이 0개인 것과 화면을
 * 못 읽은 것을 한 분기가 같이 받고 있었기 때문이다. 갤러리에서 흐름을 만들 수 있게 되면서
 * **만들자마자 반드시 지나는 자리**가 됐고, 첫인상이 오류 메시지면 안 된다.
 *
 * 여기서 바로 얹을 수 있게 둔 이유도 같다 — 만들기만 되고 채우려면 터미널로 나가야 하면
 * 절반짜리다.
 */
/**
 * 목록에서 이 페이지를 부를 이름.
 *
 * 제목이 겹칠 때만 슬러그를 덧붙인다. `createPage` 가 **같은 제목을 허용**하고 슬러그 뒤에
 * 숫자를 붙이기 때문에, 제목만 그리면 "대시보드" 버튼이 셋 나란히 서고 어느 것이 어느 것인지
 * 알 수 없다. 그렇다고 항상 슬러그를 붙이면 겹치지 않는 흔한 경우까지 지저분해진다.
 */
function label(page: PageSummary, all: PageSummary[]): string {
  const title = page.title || page.slug;
  const ambiguous = all.filter((p) => (p.title || p.slug) === title).length > 1;
  return ambiguous ? `${title} (${page.slug})` : title;
}

export function FlowEmptyScreens({
  slug,
  onAdded,
}: {
  slug: string;
  onAdded: () => void;
}) {
  const pages = useAsync(fetchPages, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (page: PageSummary): Promise<void> => {
    setBusy(page.slug);
    setError(null);
    try {
      await setFlowScreen(slug, page.slug);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="anim-fade-up mt-6 rounded-lg border border-dashed border-st-border p-10 text-center">
      <p className="text-step-0 font-medium">아직 화면이 없습니다.</p>
      <p className="mx-auto mt-2 max-w-md text-step-n1 text-st-muted-foreground">
        페이지를 화면으로 얹으면 시연이 시작됩니다. 얹는 순간의 페이지 버전이 박제되므로,
        나중에 페이지를 고쳐도 준비해 둔 시연은 그대로 재생됩니다.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-step-n2 text-st-destructive">
          {error}
        </p>
      ) : null}

      {pages.status === "loading" ? (
        <p className="mt-6 text-step-n2 text-st-muted-foreground">페이지를 불러오는 중…</p>
      ) : pages.status === "error" ? (
        <p className="mt-6 text-step-n2 text-st-destructive">{pages.error}</p>
      ) : pages.value.pages.length === 0 ? (
        <p className="mt-6 text-step-n2 text-st-muted-foreground">
          얹을 페이지가 아직 없습니다 — 페이지를 먼저 만드세요.
        </p>
      ) : (
        <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
          {pages.value.pages.map((page) => (
            <li key={page.slug}>
              <Button size="sm" disabled={busy !== null} onClick={() => void add(page)}>
                {busy === page.slug ? "얹는 중…" : label(page, pages.value.pages)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
