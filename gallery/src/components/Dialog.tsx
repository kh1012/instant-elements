import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

/** 포커스를 받을 수 있는 것들. `[tabindex="-1"]` 은 프로그램으로만 포커스하므로 뺀다. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달 대화상자 — 의존성 0.
 *
 * `CommandPalette` 도 같은 모양을 인라인으로 갖고 있지만, 그건 "열자마자 타이핑하는" 단일
 * 표면이라 포커스 트랩이 필요 없었다. 신원 설정처럼 버튼이 여럿인 모달은 Tab 이 뒤 화면으로
 * 빠져나가면 안 되므로 트랩을 갖춘 프리미티브를 따로 둔다.
 *
 * **항상 닫을 수 있다.** 첫 진입 게이팅에 쓰더라도 마찬가지다 — 닫히지 않는 모달은 로그인이
 * 안 될 때 도구 전체를 잠근다. 닫으면 저장하지 않은 것이고, 다음 방문에 다시 뜬다.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    // 닫을 때 원래 있던 자리로 포커스를 돌려준다. 안 그러면 body 로 떨어져 Tab 이 처음부터 시작한다.
    const restoreTo = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      // 양 끝에서만 감싼다 — 가운데서는 브라우저 기본 순서가 그대로 낫다.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    // 뒤 화면이 같이 스크롤되면 모달을 닫은 뒤 엉뚱한 위치에 서 있게 된다.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "w-full max-w-md rounded-xl border border-st-border bg-st-popover p-6",
          "text-st-popover-foreground shadow-xl",
          className,
        )}
      >
        <h2 id={titleId} className="text-step-1 font-semibold">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-1.5 text-step-n1 text-st-muted-foreground">
            {description}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
