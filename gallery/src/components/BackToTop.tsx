import { ArrowUpIcon } from "./icons";
import { Tooltip } from "./Tooltip";

/**
 * 우하단 "맨 위로".
 *
 * 목록이 수십 개가 되면 헤더의 검색·필터로 돌아가는 데 스크롤이 한참 걸린다. 헤더가 sticky 라
 * 늘 보이긴 하지만, 필터를 바꾸려면 목록 맨 위 툴바로 가야 한다.
 *
 * 스크롤 상태는 헤더가 이미 계산하고 있으므로(`AppHeader`) 여기서 또 듣지 않고 받아 쓴다 —
 * 같은 스크롤 이벤트에 리스너를 둘 붙일 이유가 없다.
 */
/**
 * 맨 위로 보낸다.
 *
 * 부드러운 스크롤을 **통째로 무시하는 환경**이 있다 — 자동화 브라우저에서 실측했을 때 8프레임
 * 동안 1px 도 움직이지 않았고(즉시 스크롤은 정상), 그 상태에서 이 버튼은 눌러도 아무 일이
 * 없었다. 눌렀는데 반응이 없는 버튼은 없는 것보다 나쁘다.
 *
 * 그래서 부드럽게 시도하고, 잠깐 뒤에도 제자리면 즉시 옮긴다. 정상 환경에서는 그 사이 이미
 * 움직였으므로 이 분기에 걸리지 않는다.
 */
function scrollToTop(): void {
  const start = window.scrollY;
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => {
    if (window.scrollY === start && start !== 0) window.scrollTo(0, 0);
  }, 120);
}

export function BackToTop({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-popover">
      <Tooltip content="맨 위로" side="top">
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="맨 위로"
          className="press anim-fade-in grid size-10 place-items-center rounded-full border border-st-border bg-st-background/80 text-st-muted-foreground shadow-lg backdrop-blur-md hover:text-st-foreground"
        >
          <ArrowUpIcon />
        </button>
      </Tooltip>
    </div>
  );
}
