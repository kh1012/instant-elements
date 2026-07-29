import type { ReactNode } from "react";
import { FRAMES, SELECTABLE_FRAMES, type FrameId } from "instant-elements/page";
import { cn } from "../lib/cn";

/**
 * 해상도 프레임.
 *
 * 미리보기를 **고정 크기 캔버스** 안에 가둔다 — 페이지가 어느 해상도를 전제로 저작됐는지가
 * 화면에서 사라지지 않게 하기 위함이다. 브라우저 창에 맞춰 늘어나면 `_widthMode: "fill"` 이
 * 차지하는 폭이 보는 사람마다 달라져 리뷰가 성립하지 않는다.
 *
 * **1:1 로 그리고 넘치면 스크롤한다.** 축소하지 않는 이유: 포털로 `document.body` 에 빠져나가는
 * 컴포넌트(모달·팝오버·툴팁)가 스케일 밖에 그려져 크기와 위치가 어긋나기 때문이다.
 *
 * `preview-surface` — 이 안은 **제품 화면**이다. 갤러리 크롬의 모노톤이 아니라 제품 실제 색이
 * 나와야 한다(styles.css 주석 참고).
 */
export function PageFrame({
  frame,
  children,
  className,
  zoom = 1,
}: {
  frame: FrameId;
  children: ReactNode;
  className?: string;
  /** 1 이 1:1. 축소는 **보기 위한 것**이지 저작 기준이 아니다(아래 주의 참고). */
  zoom?: number;
}) {
  const size = FRAMES[frame];
  return (
    <div className="overflow-auto rounded-lg border border-st-border bg-st-muted p-6">
      <div
        // 축소는 wrapper 크기까지 함께 줄여야 스크롤 영역이 남지 않는다.
        style={{ width: size.width * zoom, height: size.height * zoom }}
        className="mx-auto"
      >
        <div
          className={cn("preview-surface shrink-0 bg-st-background shadow-sm", className)}
          style={{
            width: size.width,
            minHeight: size.height,
            transform: zoom === 1 ? undefined : `scale(${zoom})`,
            transformOrigin: "top left",
          }}
          data-frame={frame}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * 줌 컨트롤.
 *
 * ⚠️ **축소는 보기 위한 것이지 판단 기준이 아니다.** 포털로 `document.body` 에 빠져나가는
 * 컴포넌트(모달·팝오버·툴팁)는 scale 밖에 그려져 크기와 위치가 어긋난다. 그래서 기본은 1:1 이고,
 * 축소는 "전체 배치를 훑어볼" 때만 쓴다 — 100% 로 되돌리는 버튼을 늘 옆에 둔다.
 */
export function ZoomControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (zoom: number) => void;
}) {
  const step = (delta: number) =>
    onChange(Math.min(1, Math.max(0.25, Math.round((value + delta) * 100) / 100)));

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-st-muted p-0.5">
      <button
        type="button"
        onClick={() => step(-0.1)}
        aria-label="축소"
        className="press h-7 w-7 rounded-sm text-step-n1 hover:bg-st-card"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onChange(1)}
        aria-label="100% 로 되돌리기"
        className={cn(
          "press h-7 min-w-12 rounded-sm px-1 text-step-n2",
          value === 1 ? "text-st-muted-foreground" : "bg-st-card text-st-foreground",
        )}
      >
        {Math.round(value * 100)}%
      </button>
      <button
        type="button"
        onClick={() => step(0.1)}
        aria-label="확대"
        className="press h-7 w-7 rounded-sm text-step-n1 hover:bg-st-card"
      >
        +
      </button>
    </div>
  );
}

export function FrameToggle({
  value,
  onChange,
}: {
  value: FrameId;
  onChange: (frame: FrameId) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-st-muted p-0.5">
      {SELECTABLE_FRAMES.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "press rounded-sm px-2 py-1 text-step-n2",
            value === id
              ? "bg-st-card text-st-foreground shadow-sm"
              : "text-st-muted-foreground hover:text-st-foreground",
          )}
        >
          {FRAMES[id].label}
          <span className="ml-1 opacity-60">
            {FRAMES[id].width}×{FRAMES[id].height}
          </span>
        </button>
      ))}
    </div>
  );
}
