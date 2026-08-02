import { useEffect, useState } from "react";
import { fetchPageVersions, restorePageVersion, type PageVersion } from "../lib/api";
import { formatAt } from "../lib/format";

/**
 * 버전 목록 + 복원.
 *
 * 컴포넌트의 `RestoreControl` 과 같은 **인라인 2단계 확인**이다(모달 없음). 다만 확인 문구
 * 위에 "무엇이 달라지는지"를 먼저 보여 준다 — 페이지는 코드가 아니라 배치라 버전만 봐서는
 * 되돌렸을 때 무엇이 바뀌는지 짐작할 수 없다. 노드 수 변화가 그 최소한의 단서다.
 *
 * 복원은 **되감기가 아니라 새 버전**이다(서버 주석 참고). 그래서 복원한 것을 다시 복원할 수 있다.
 */
export function PageVersions({
  slug,
  current,
  onRestored,
  currentNodes,
}: {
  slug: string;
  current: string;
  onRestored: () => void;
  /** 지금 페이지의 노드 수 — 각 버전과 견줘 "얼마나 달라지나"를 보여 준다. */
  currentNodes: number;
}) {
  const [versions, setVersions] = useState<PageVersion[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPageVersions(slug)
      .then((result) => {
        if (alive) setVersions(result.versions);
      })
      .catch(() => {
        if (alive) setVersions([]);
      });
    // `current` 가 바뀌면(저장·복원 후) 목록을 다시 읽는다.
  }, [slug, current]);

  if (versions === null) {
    return <p className="text-step-n2 text-st-muted-foreground">버전을 읽는 중…</p>;
  }

  if (versions.length === 0) {
    return (
      <p className="text-step-n2 text-st-muted-foreground">
        되돌릴 수 있는 이전 버전이 아직 없습니다.
      </p>
    );
  }

  const restore = (version: string) => {
    setBusy(true);
    setError(null);
    void restorePageVersion(slug, version)
      .then(() => {
        setConfirming(null);
        onRestored();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  return (
    <ul className="flex flex-col gap-2">
      {versions.map((version) => {
        const delta = version.nodes - currentNodes;
        return (
          <li key={version.version} className="text-step-n2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono">v{version.version}</span>
              <span className="text-st-muted-foreground">{formatAt(version.updatedAt)}</span>
            </div>
            <p className="text-st-muted-foreground">
              {version.title} · 노드 {version.nodes}개
              {delta !== 0 ? (
                <span className={delta > 0 ? "text-st-success" : "text-st-destructive"}>
                  {" "}
                  ({delta > 0 ? "+" : ""}
                  {delta})
                </span>
              ) : (
                " (지금과 같음)"
              )}
            </p>

            {confirming === version.version ? (
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-st-muted-foreground">이 내용으로 되돌릴까요?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => restore(version.version)}
                  className="font-medium underline"
                >
                  되돌리기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="text-st-muted-foreground underline"
                >
                  취소
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(version.version)}
                className="mt-0.5 text-st-muted-foreground underline-offset-2 hover:text-st-foreground hover:underline"
              >
                이 버전으로 되돌리기
              </button>
            )}
          </li>
        );
      })}
      {error ? <li className="text-step-n2 text-st-destructive">{error}</li> : null}
    </ul>
  );
}
