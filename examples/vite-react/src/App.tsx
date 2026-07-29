import { PageHeader } from "@/elements/page-header";
import { StatCard } from "@/elements/stat-card";

/**
 * 생성된 컴포넌트를 실제 앱에서 쓰는 모습.
 *
 * 갤러리는 개발 도구일 뿐이고, 프로덕션 번들에는 들어가지 않는다 — 여기 보이는 import 만 들어간다.
 */
export function App() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <PageHeader title="분기 리포트" description="핵심 지표를 한눈에 봅니다." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="총 매출" description="전월 대비 +12%" />
        <StatCard title="신규 고객" description="전월 대비 +4%" />
        <StatCard title="이탈률" description="2.1%" />
      </div>
    </main>
  );
}
