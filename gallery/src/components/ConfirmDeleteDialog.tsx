import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/**
 * 삭제 확인 — **이름을 그대로 적어야 버튼이 열린다.**
 *
 * "정말 지울까요? [예]" 는 손이 기억한 위치를 누르는 동작이라, 세 번째부터는 읽지 않고 눌린다.
 * 타이핑은 그 자동화를 끊는다 — 이름을 옮겨 적으려면 **무엇을 지우는지 한 번은 읽어야 한다.**
 * (GitHub 이 저장소 삭제에 쓰는 방식과 같다.)
 *
 * 지우는 대상이 커밋 안 된 몇 시간짜리 작업일 수 있어서 이 마찰이 값을 한다. 되돌리기가 없는
 * 조작이라 마찰을 앞에 두는 것 말고는 안전장치가 없다.
 */
export function ConfirmDeleteDialog({
  open,
  onClose,
  title,
  /** 사용자가 그대로 옮겨 적어야 하는 값. 보통 슬러그다. */
  confirmWord,
  description,
  submitLabel = "지우기",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  confirmWord: string;
  /** 무엇이 함께 사라지는지 — 이름을 적기 전에 읽을 내용이다. */
  description?: ReactNode;
  submitLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setError(null);
    setBusy(false);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  // 한글은 macOS 가 NFD 로 다루는 자리가 있어 눈에 같아 보여도 문자열이 다르다.
  const matches = typed.normalize("NFC") === confirmWord.normalize("NFC");

  const confirm = async (): Promise<void> => {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      // 닫기와 이동은 호출자가 한다 — 여기서 닫으면 목록이 갱신되기 전 한 프레임이 스친다.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        {description ? <div className="text-step-n1 text-st-muted-foreground">{description}</div> : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-step-n2 text-st-muted-foreground">
            확인을 위해 <code className="text-st-foreground">{confirmWord}</code> 를 그대로 적으세요
          </span>
          <input
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            className="h-9 rounded-full border border-st-border bg-st-background px-3.5 text-step-n1 outline-none focus:border-st-foreground disabled:opacity-60"
          />
        </label>

        {error ? (
          <p role="alert" className="text-step-n2 text-st-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            취소
          </Button>
          {/*
            버튼 자체가 위험색이다. 이 화면에서 되돌릴 수 없는 것은 이것 하나뿐이라,
            취소와 같은 톤이면 어느 쪽이 위험한지 색으로 안 읽힌다.
          */}
          <Button type="submit" variant="danger" disabled={!matches || busy}>
            {busy ? "지우는 중…" : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
