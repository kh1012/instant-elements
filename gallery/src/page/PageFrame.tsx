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
}: {
  frame: FrameId;
  children: ReactNode;
  className?: string;
}) {
  const size = FRAMES[frame];
  return (
    <div className="overflow-auto rounded-lg border border-st-border bg-st-muted p-6">
      <div
        className={cn("preview-surface mx-auto shrink-0 bg-st-background shadow-sm", className)}
        style={{ width: size.width, minHeight: size.height }}
        data-frame={frame}
      >
        {children}
      </div>
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
