import { useRef, useState } from "react";
import { SELECTABLE_FRAMES, FRAMES, type FrameId } from "instant-elements/page";
import { setFlowSettings } from "../lib/api";
import { cn } from "../lib/cn";
import { Popover } from "../components/Popover";
import { ChevronDownIcon } from "../components/icons";

/**
 * 흐름 설정 — 시작 화면과 프레임.
 *
 * 시연 직전에 가장 자주 나오는 요청이 "시작을 이 화면으로 바꿔줘"인데, 지금까지는 터미널로
 * 나가야 했다. 시연 준비 중에 가장 하기 싫은 일이다.
 *
 * 프레임을 흐름에 두는 이유: 없으면 페이지마다 `pageSize` 를 따라가서 **시연 중 캔버스가 화면을
 * 넘길 때마다 리사이즈된다.** 흐름이 정하면 그 값이 페이지를 이긴다. "페이지를 따름"으로
 * 되돌리는 길도 남겨 둔다 — 한 해상도로 저작한 흐름에서는 그게 맞다.
 */
export function FlowSettings({
  slug,
  screens,
  start,
  frame,
  onChanged,
}: {
  slug: string;
  screens: { slug: string; title: string }[];
  start: string | undefined;
  frame: string | undefined;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (input: { start?: string; frame?: string }) => {
    setBusy(true);
    setError(null);
    void setFlowSettings(slug, input)
      .then(onChanged)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  // 시작을 안 정했으면 첫 화면이 시작이다 — 그 사실을 라벨로 알려 준다.
  const effectiveStart = start ?? screens[0]?.slug;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Picker
        label="시작 화면"
        current={screens.find((s) => s.slug === effectiveStart)?.title ?? "없음"}
        hint={start ? undefined : "지정 안 함 — 첫 화면"}
        disabled={busy || screens.length === 0}
        options={screens.map((screen) => ({ value: screen.slug, label: screen.title }))}
        value={effectiveStart ?? ""}
        onPick={(value) => apply({ start: value })}
      />

      <Picker
        label="프레임"
        current={frame ? (FRAMES[frame as FrameId]?.label ?? frame) : "페이지를 따름"}
        disabled={busy}
        options={[
          { value: "", label: "페이지를 따름" },
          ...SELECTABLE_FRAMES.map((id) => ({
            value: id,
            label: `${FRAMES[id].label} ${FRAMES[id].width}×${FRAMES[id].height}`,
          })),
        ]}
        value={frame ?? ""}
        onPick={(value) => apply({ frame: value })}
      />

      {error ? <span className="text-step-n2 text-st-destructive">{error}</span> : null}
    </div>
  );
}

function Picker({
  label,
  current,
  hint,
  options,
  value,
  onPick,
  disabled,
}: {
  label: string;
  current: string;
  hint?: string | undefined;
  options: { value: string; label: string }[];
  value: string;
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current}`}
        className={cn(
          "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-step-n2",
          "disabled:pointer-events-none disabled:opacity-50",
          open
            ? "border-st-foreground/25 bg-st-muted"
            : "border-st-border hover:bg-st-muted/60",
        )}
      >
        <span className="text-st-muted-foreground">{label}</span>
        <span className="text-st-foreground">{current}</span>
        {hint ? <span className="text-st-muted-foreground">({hint})</span> : null}
        <ChevronDownIcon width={12} height={12} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align="start" label={label}>
        <ul role="listbox" aria-label={label} className="min-w-48 py-1">
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onPick(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-step-n2",
                  option.value === value ? "bg-st-muted" : "hover:bg-st-muted/60",
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}
