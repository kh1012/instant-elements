import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { TOAST_EVENT, type ToastDetail, type ToastVariant } from "../lib/toast";

/**
 * 토스트 표시대 — 앱 루트에 한 번만 마운트한다.
 *
 * 되돌릴 수 없는 조작(삭제·복원)이 **끝났다는 사실**을 말할 자리가 지금까지 없었다. 조용히
 * 성공하면 사람은 눌린 건지 아닌지를 화면을 다시 읽어 확인해야 한다.
 */

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let seq = 0;

/**
 * warning·error 가 더 오래 남는 이유: 중립 토스트는 "끝났다"만 말하지만 저 둘은 **읽고 판단할
 * 내용**을 담는다. 같은 2.2초면 다 읽기 전에 사라진다.
 */
const DURATION: Record<ToastVariant, number> = {
  default: 2200,
  warning: 4000,
  error: 5000,
};

/** 색으로 먼저 읽힌다 — 문장을 다 읽기 전에 "좋은 소식인지"가 결정돼야 한다. */
const VARIANT_CLASS: Record<ToastVariant, string> = {
  default: "border-st-border bg-st-card text-st-foreground",
  warning: "border-st-warning/40 bg-st-warning/10 text-st-warning",
  error: "border-st-destructive/40 bg-st-destructive/10 text-st-destructive",
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event): void => {
      const detail = (event as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;

      const id = ++seq;
      const variant = detail.variant ?? "default";
      // 최근 3개만 남긴다. 더 쌓이면 화면 아래가 토스트로 덮여 정작 결과를 못 본다.
      setToasts((current) => [...current.slice(-2), { id, message: detail.message, variant }]);

      window.setTimeout(
        () => setToasts((current) => current.filter((item) => item.id !== id)),
        detail.duration ?? DURATION[variant],
      );
    };

    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          /*
           * warning·error 는 놓치면 안 되는 정보라 개별 항목에 assertive 를 얹는다. 컨테이너의
           * polite 와 중첩되지만, 더 급한 쪽이 안쪽에 오는 것은 aria-live 의 정상 용법이다.
           */
          {...(item.variant === "default" ? {} : { role: "alert", "aria-live": "assertive" as const })}
          // 줄바꿈이 있는 메시지는 그대로 두 줄로 — "무엇이 끝났는지"와 "무엇이 남았는지"를
          // 나눠 적을 때 한 줄로 붙으면 안 읽힌다.
          className={cn(
            "anim-pop-in pointer-events-auto max-w-[min(90vw,30rem)] whitespace-pre-line rounded-full border px-4 py-2 text-center text-step-n1 shadow-lg",
            VARIANT_CLASS[item.variant],
          )}
        >
          {item.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}
