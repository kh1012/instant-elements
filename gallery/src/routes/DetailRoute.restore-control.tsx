import { useState } from "react";
import { restoreEntry } from "../lib/api";

type Phase =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "restoring" }
  | { kind: "done"; commit: string; files: number }
  | { kind: "error"; message: string };

/**
 * 이 시점으로 되돌리기.
 *
 * 히스토리에 SHA 가 남아 있는데 그걸로 되돌릴 손잡이가 없었다 — **기록의 가치는 되돌릴 수
 * 있을 때 생긴다.** 로직은 CLI(`ie element restore`)와 같은 함수를 부른다.
 *
 * 되돌리기는 파일을 덮어쓴다. 그래서 확인을 한 번 받고, 어느 시점인지 SHA 앞자리를 함께
 * 보여 준다 — "이 시점"이라는 말만으로는 무엇이 사라지는지 알 수 없다.
 *
 * 끝난 뒤 새로고침을 권하는 이유: 되돌린 것은 **디스크의 파일**이라 Vite HMR 이 데모는 다시
 * 그려도, 빌드 타임에 굳은 엔트리 목록(props·설명)은 그대로 남는다.
 */
export function RestoreControl({
  name,
  sha,
  running,
}: {
  name: string;
  sha: string;
  running: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const short = sha.slice(0, 7);

  if (running) return null;

  if (phase.kind === "done") {
    return (
      <p className="mt-2 text-step-n2 text-st-success">
        복원 완료 ({phase.files}개 파일 · {phase.commit.slice(0, 7)}).{" "}
        <button type="button" onClick={() => window.location.reload()} className="underline">
          새로고침
        </button>
      </p>
    );
  }

  if (phase.kind === "error") {
    return (
      <p className="mt-2 text-step-n2 text-st-destructive">
        {phase.message}{" "}
        <button type="button" onClick={() => setPhase({ kind: "idle" })} className="underline">
          다시
        </button>
      </p>
    );
  }

  if (phase.kind === "restoring") {
    return <p className="mt-2 text-step-n2 text-st-muted-foreground">되돌리는 중…</p>;
  }

  if (phase.kind === "confirming") {
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 text-step-n2">
        <span className="text-st-muted-foreground">
          이 시점(<code className="font-mono">{short}</code>)으로 되돌릴까요? 지금 파일을 덮어씁니다.
        </span>
        <button
          type="button"
          onClick={() => {
            setPhase({ kind: "restoring" });
            void restoreEntry(name, sha)
              .then((result) =>
                setPhase({ kind: "done", commit: result.commit, files: result.files.length }),
              )
              .catch((err: unknown) =>
                setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) }),
              );
          }}
          className="font-medium underline"
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={() => setPhase({ kind: "idle" })}
          className="text-st-muted-foreground underline"
        >
          취소
        </button>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase({ kind: "confirming" })}
      className="mt-2 text-step-n2 text-st-muted-foreground underline-offset-2 hover:text-st-foreground hover:underline"
    >
      이 시점으로 되돌리기
    </button>
  );
}
