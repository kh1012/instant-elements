import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";

/** 화면 가장자리와 띄울 최소 여백. 붙어 버리면 잘린 것처럼 보인다. */
const EDGE = 8;
/** 트리거와 패널 사이 간격. */
const GAP = 6;

/**
 * 앵커드 팝오버 — 의존성 0.
 *
 * `position: absolute` 로 트리거 옆에 붙이면 조상 중 하나라도 `overflow: hidden` 이면 잘린다.
 * 헤더 pill 도 카드도 전부 그런 조상이라, 실제로 쓰이는 자리마다 잘렸다. 그래서 body 로 포털한 뒤
 * `position: fixed` + 트리거의 화면 좌표로 직접 배치한다.
 *
 * 열림 상태는 호출자가 쥔다 — 트리거의 모양(아이콘/버튼/링크)은 자리마다 다른데, 그걸 이 안에서
 * 추상화하려 들면 슬롯 API 가 컴포넌트보다 커진다.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  align = "end",
  children,
  className,
  label,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** 트리거를 기준으로 어느 쪽 끝을 맞출지. */
  align?: "start" | "center" | "end";
  children: ReactNode;
  className?: string;
  /** 스크린리더용 이름. 팝오버 안에 제목이 없을 때 무엇이 열렸는지 알려 준다. */
  label?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  /*
   * 페인트 **전에** 위치를 잡는다. useEffect 로 미루면 한 프레임 동안 (0,0) 에 그려졌다가
   * 튀어 들어오는 것이 눈에 보인다.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const a = anchor.getBoundingClientRect();
      const p = panel.getBoundingClientRect();

      let left =
        align === "start" ? a.left : align === "center" ? a.left + a.width / 2 - p.width / 2 : a.right - p.width;
      // 오른쪽으로 넘치면 당기고, 그러다 왼쪽으로 넘치면 다시 민다. 순서가 중요하다 —
      // 반대로 하면 좁은 화면에서 왼쪽 보정이 오른쪽 보정에 덮인다.
      left = Math.min(left, window.innerWidth - p.width - EDGE);
      left = Math.max(left, EDGE);

      // 아래가 좁으면 위로 뒤집는다.
      const below = a.bottom + GAP;
      const flip = below + p.height > window.innerHeight - EDGE && a.top - GAP - p.height > EDGE;
      setPosition({ top: flip ? a.top - GAP - p.height : below, left });
    };

    place();
    // 스크롤·리사이즈로 트리거가 움직이면 패널이 따라가야 한다. capture 로 받아야 내부
    // 스크롤 컨테이너의 스크롤도 잡힌다(scroll 은 버블링하지 않는다).
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, align, anchorRef]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      // 트리거 클릭까지 "바깥"으로 세면 토글이 닫고-여는 두 번을 하게 되어 절대 안 열린다.
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  // 닫을 때 좌표를 버린다 — 다음에 열 때 옛 위치가 한 프레임 비치지 않게.
  useEffect(() => {
    if (!open) setPosition(null);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
      className={cn(
        "fixed z-modal-popover rounded-lg border border-st-border bg-st-popover",
        "text-st-popover-foreground shadow-lg",
        // 측정이 끝나기 전에는 보이지 않게 — 위치가 정해진 뒤에만 드러난다.
        position ? "opacity-100" : "pointer-events-none opacity-0",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
