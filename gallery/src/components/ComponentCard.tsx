import type { Entry } from "instant-elements/registry";
import { Link } from "../router";
import { isNew } from "../lib/search";
import { CategoryBadge, NewBadge, StatusBadge } from "./StatusBadge";
import { SafePreview } from "./SafePreview";
import { useInView } from "./useInView";

/**
 * 목록 카드.
 *
 * 프리뷰 영역은 미리 자리를 잡아 두고 **뷰포트 근처에 왔을 때만** 실제 데모를 마운트한다.
 * 자리를 먼저 잡는 이유: 나중에 채우면 스크롤 위치가 밀려 읽던 자리를 잃는다.
 */
export function ComponentCard({ entry }: { entry: Entry }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <Link
      to={`/c/${entry.name}`}
      className="press group flex flex-col overflow-hidden rounded-lg border border-st-border bg-st-card hover:-translate-y-1 hover:shadow-lg"
    >
      <div
        ref={ref}
        className="flex h-40 items-center justify-center overflow-hidden bg-st-background p-4"
      >
        {inView ? (
          <div className="scale-90">
            <SafePreview name={entry.name} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-st-border p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-step-n1 font-medium text-st-card-foreground">{entry.name}</span>
          {isNew(entry) ? <NewBadge /> : null}
        </div>
        <p className="line-clamp-2 text-step-n2 text-st-muted-foreground">
          {entry.meta.summary || entry.meta.intent}
        </p>
        <div className="flex items-center gap-1.5 pt-0.5">
          <CategoryBadge category={entry.meta.category} />
          <StatusBadge status={entry.meta.status} />
        </div>
      </div>
    </Link>
  );
}
