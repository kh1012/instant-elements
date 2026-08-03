import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

/**
 * 이름 하나만 받아 만드는 대화상자.
 *
 * 페이지와 흐름이 이걸 공유한다. 둘 다 **만들 때 정할 것이 이름뿐**이기 때문이다 — 나머지는
 * 만든 다음 화면에서 정하거나 에이전트가 채운다. 만들기 전에 프레임·시작 화면까지 물으면
 * 아직 아무것도 없는 상태에서 답할 수 없는 걸 묻는 꼴이 된다.
 *
 * 슬러그는 **보여 주지 않는다.** 제목에서 자동으로 만들어지고 충돌하면 숫자가 붙는데,
 * 그 규칙을 만들기 화면에서 설명하기 시작하면 "이름만 정하면 된다"가 무너진다. 결과 주소는
 * 만든 뒤 서버가 알려 준 slug 로 이동하면서 자연히 드러난다.
 */
export function CreateDialog({
  open,
  onClose,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  /** 성공하면 이동할 주소를 돌려준다. 던지면 그 메시지를 그대로 보여 준다. */
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 열 때마다 초기화한다. 지난번에 실패한 이름과 빨간 메시지가 남아 있으면 새로 여는 게 아니다.
  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
    setBusy(false);
    // Dialog 가 첫 포커서블에 포커스를 주지만, 그게 입력란이라는 보장은 없다.
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  const submit = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      // 성공하면 호출자가 이동시킨다 — 여기서 닫으면 이동 전에 빈 목록이 한 번 스친다.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} {...(description ? { description } : {})}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-step-n2 text-st-muted-foreground">{label}</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            maxLength={200}
            disabled={busy}
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
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? "만드는 중…" : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
