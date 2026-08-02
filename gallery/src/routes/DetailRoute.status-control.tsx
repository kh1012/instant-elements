import { useState } from "react";
import type { ElementStatus } from "instant-elements/registry";
import { setEntryStatus } from "../lib/api";
import { cn } from "../lib/cn";

/** 다음으로 갈 만한 상태. draft 는 기본값이라 되돌릴 자리로만 쓴다. */
const NEXT: Record<ElementStatus, { to: ElementStatus; label: string; tone: "primary" | "danger" }[]> = {
  draft: [
    { to: "stable", label: "stable 로 승격", tone: "primary" },
    { to: "deprecated", label: "deprecated 로 표시", tone: "danger" },
  ],
  stable: [{ to: "deprecated", label: "deprecated 로 표시", tone: "danger" }],
  deprecated: [{ to: "draft", label: "draft 로 되돌리기", tone: "primary" }],
};

type Phase =
  | { kind: "idle" }
  | { kind: "confirming"; to: ElementStatus }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

/**
 * 상태 변경 — 정보 패널의 "상태" 행 안에 산다.
 *
 * 별도 화면이나 모달로 빼지 않는다. 상태는 **읽으러 온 김에** 바꾸는 값이라, 지금 값이 보이는
 * 그 자리에서 바꿀 수 있어야 왕복이 사라진다.
 *
 * 한 번 더 묻는 이유: deprecated 는 목록에서 그 컴포넌트를 감춘다. 실수로 눌렀을 때 "왜
 * 사라졌지"를 겪게 하지 않으려면 확인이 필요하다.
 */
export function StatusControl({
  name,
  status,
  running,
  onChanged,
}: {
  name: string;
  status: ElementStatus;
  /** 에이전트가 이 컴포넌트를 고치는 중인가. */
  running: boolean;
  onChanged: (next: ElementStatus) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const apply = (to: ElementStatus) => {
    setPhase({ kind: "submitting" });
    void setEntryStatus(name, to)
      .then(() => {
        setPhase({ kind: "idle" });
        onChanged(to);
      })
      .catch((err: unknown) =>
        setPhase({ kind: "error", message: err instanceof Error ? err.message : String(err) }),
      );
  };

  if (running) {
    return (
      <p className="mt-1 text-step-n2 text-st-muted-foreground">
        지금 고치는 중이라 상태를 바꿀 수 없습니다.
      </p>
    );
  }

  if (phase.kind === "submitting") {
    return <p className="mt-1 text-step-n2 text-st-muted-foreground">바꾸는 중…</p>;
  }

  if (phase.kind === "error") {
    return (
      <p className="mt-1 text-step-n2 text-st-destructive">
        {phase.message}{" "}
        <button type="button" onClick={() => setPhase({ kind: "idle" })} className="underline">
          다시
        </button>
      </p>
    );
  }

  if (phase.kind === "confirming") {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-2 text-step-n2">
        <span className="text-st-muted-foreground">{phase.to} 로 바꿀까요?</span>
        <button type="button" onClick={() => apply(phase.to)} className="font-medium underline">
          변경
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
    <span className="mt-1 flex flex-wrap gap-3">
      {NEXT[status].map((option) => (
        <button
          key={option.to}
          type="button"
          onClick={() => setPhase({ kind: "confirming", to: option.to })}
          className={cn(
            "text-step-n2 underline-offset-2 hover:underline",
            option.tone === "danger" ? "text-st-destructive" : "text-st-primary",
          )}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}
