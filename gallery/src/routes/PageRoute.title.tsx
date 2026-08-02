import { useEffect, useRef, useState } from "react";
import { setPageTitle } from "../lib/api";
import { cn } from "../lib/cn";

/**
 * 제목 인라인 편집.
 *
 * 제목은 이 화면에서 **바로 고칠 수 있어야 하는** 값이다. 다른 화면으로 보내면 오타 하나
 * 고치려고 리뷰 맥락을 잃는다.
 *
 * 편집으로 들어갈 때 문자열을 통째로 선택해 둔다 — 제목 바꾸기는 대개 "이 이름 말고 저 이름"이라
 * 처음부터 다시 치는 쪽이 흔하다.
 *
 * **키 이벤트를 여기서 끊는다.** 이 화면에는 Escape 를 듣는 것들이 여럿 있어(팔레트·팝오버),
 * 제목 편집을 취소하려던 Escape 가 그대로 올라가면 엉뚱한 것이 함께 닫힌다.
 */
export function PageTitle({
  slug,
  title,
  onSaved,
}: {
  slug: string;
  title: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    input?.focus();
    input?.select();
  }, [editing]);

  const save = () => {
    const next = value.trim();
    if (!next || next === title) {
      setEditing(false);
      setValue(title);
      return;
    }
    setBusy(true);
    setError(null);
    void setPageTitle(slug, next)
      .then(() => {
        setEditing(false);
        onSaved();
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  if (!editing) {
    return (
      <div>
        {/* 읽기 상태에서도 눌리는 자리임을 hover 틴트로 알린다. */}
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="눌러서 제목 바꾸기"
          className="press -mx-2 rounded-md px-2 text-left text-step-2 font-semibold hover:bg-st-muted/60"
        >
          {title}
        </button>
        {error ? <p className="mt-1 text-step-n2 text-st-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      disabled={busy}
      maxLength={120}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        // 이 화면의 다른 Escape 청취자에게 올라가지 않게 여기서 끊는다.
        event.stopPropagation();
        if (event.key === "Enter") save();
        if (event.key === "Escape") {
          setValue(title);
          setEditing(false);
        }
      }}
      className={cn(
        "-mx-2 w-full max-w-md rounded-md border border-st-ring bg-st-background px-2",
        "text-step-2 font-semibold outline-none",
      )}
    />
  );
}
