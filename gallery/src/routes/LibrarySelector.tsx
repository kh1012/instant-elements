import { useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Popover } from "../components/Popover";
import { ChevronDownIcon } from "../components/icons";

export interface SelectorOption<T extends string> {
  value: T;
  label: string;
  /** 라벨 오른쪽의 개수. 0 이어도 표시한다 — 아래 주석 참고. */
  count?: number;
  /** 왜 이 선택지가 있는지. hover 로만 보이는 보조 설명. */
  note?: string;
}

/**
 * 컴팩트 선택기.
 *
 * 칩을 늘어놓지 않고 접는다. 축이 넷(활동·분류·정렬·미리보기)이 되면 칩 열넷이 툴바를 두 줄로
 * 만들고, 그 줄이 목록보다 눈에 먼저 들어온다.
 *
 * **0건인 선택지도 지우지 않고 비활성으로 남긴다.** 상류에서 배운 것이다 — 0건이라고 숨기면
 * 축 자체가 사라져 "실행 중" 필터가 있었다는 사실조차 모르게 된다. 남겨 두면 "지금은 없구나"가
 * 정보가 된다. (칩으로 늘어놓던 시절에는 숨기는 게 맞았다. 자리를 차지했으니까.)
 */
export function LibrarySelector<T extends string>({
  label,
  options,
  value,
  onChange,
  icon,
}: {
  label: string;
  options: SelectorOption<T>[];
  value: T;
  onChange: (next: T) => void;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const current = options.find((option) => option.value === value);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? value}`}
        className={cn(
          "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-step-n2",
          open
            ? "border-st-foreground/25 bg-st-muted text-st-foreground"
            : "border-st-border text-st-muted-foreground hover:bg-st-muted/60 hover:text-st-foreground",
        )}
      >
        {icon}
        <span className="text-st-foreground">{current?.label ?? value}</span>
        {current?.count !== undefined ? (
          <span className="opacity-70">{current.count}</span>
        ) : null}
        <ChevronDownIcon width={12} height={12} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align="start" label={label}>
        <ul role="listbox" aria-label={label} className="min-w-44 py-1">
          {options.map((option) => {
            const empty = option.count === 0;
            const active = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  disabled={empty && !active}
                  title={option.note}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-step-n2",
                    active ? "bg-st-muted text-st-foreground" : "text-st-foreground hover:bg-st-muted/60",
                    empty && !active ? "cursor-not-allowed opacity-40 hover:bg-transparent" : "",
                  )}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.count !== undefined ? (
                    <span className="shrink-0 text-st-muted-foreground">{option.count}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}
