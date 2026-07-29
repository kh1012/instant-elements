import { StatCard } from "./stat-card";

/**
 * 갤러리 미리보기 한 컷.
 *
 * default export 여야 하고, props 없이 스스로 그려져야 한다(갤러리가 인자를 주지 않는다).
 * 카드 프레임이 작으므로 대표적인 상태 **하나만** 담는다 — 타이머·루프 애니메이션은 넣지 않는다.
 */
export default function StatCardDemo() {
  return (
    <div className="w-72">
      <StatCard title="StatCard" description="여기에 대표 상태 한 컷을 담습니다." />
    </div>
  );
}
