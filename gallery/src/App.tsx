import { useEffect, useState } from "react";
import { AppHeader, type Section } from "./components/AppHeader";
import { CommandPalette } from "./components/CommandPalette";
import { IdentityModal } from "./components/IdentityModal";
import { IdentityProvider } from "./components/IdentityProvider";
import { LinkNotice } from "./components/LinkNotice";
import { RunPanel } from "./components/RunPanel";
import { SearchBox } from "./components/SearchBox";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { AgentProvider } from "./lib/agent-store";
import { HeaderSearchProvider } from "./lib/header-search";
import { useIdentity } from "./lib/identity";
import { DetailRoute } from "./routes/DetailRoute";
import { FlowRoute } from "./routes/FlowRoute";
import { FlowsRoute } from "./routes/FlowsRoute";
import { LibraryRoute } from "./routes/LibraryRoute";
import { PageRoute } from "./routes/PageRoute";
import { PagesRoute } from "./routes/PagesRoute";
import { safeDecode, usePath } from "./router";

export function App() {
  return (
    // 실행 상태는 라우트 위에 있다 — 화면을 옮겨도 돌던 실행과 SSE 연결이 끊기면 안 된다.
    // 신원도 마찬가지로 라우트 위다: 헤더 아바타와 히스토리 작성자가 같은 값을 봐야 한다.
    <AgentProvider>
      <IdentityProvider>
        {/* 검색어도 라우트 위다 — 헤더의 입력창이 화면을 옮길 때마다 다시 마운트되면 안 된다. */}
        <HeaderSearchProvider>
          <Shell />
        </HeaderSearchProvider>
      </IdentityProvider>
    </AgentProvider>
  );
}

function Shell() {
  const path = usePath();
  const { identity, loading } = useIdentity();
  const [identityOpen, setIdentityOpen] = useState(false);

  /*
   * 신원이 없으면 첫 진입에서 한 번 묻는다.
   *
   * `loading` 이 끝나기를 기다리는 게 핵심이다 — 조회 전에 열면 이미 이름을 정해 둔 사람에게도
   * 창이 깜빡였다가 사라진다. 닫아도 저장하지 않은 것이라 다음 방문에 다시 뜬다.
   */
  useEffect(() => {
    if (!loading && !identity) setIdentityOpen(true);
  }, [loading, identity]);

  const detail = /^\/c\/(.+)$/.exec(path);
  const page = /^\/pages\/(.+)$/.exec(path);
  const flow = /^\/flows\/(.+)$/.exec(path);

  // 활성 네비는 라우트 정규식이 아니라 이 한 값으로 결정한다 — 라우트가 늘 때마다
  // 헤더의 조건식을 함께 고치면 반드시 어긋난다.
  const section: Section = path.startsWith("/pages")
    ? "pages"
    : path.startsWith("/flows")
      ? "flows"
      : "library";

  return (
    <>
      <div className="min-h-full bg-st-background text-st-foreground">
        <AppHeader active={section} onOpenIdentity={() => setIdentityOpen(true)} />
        {/*
          검색창은 헤더 안에 그려지지만 **마운트는 여기서** 한다. 헤더 트리 안에 두면 라우트가
          바뀔 때 함께 다시 그려져 포커스와 입력이 날아간다.
        */}
        <SearchBox />
        <LinkNotice />
        <CommandPalette />
        <ShortcutsDialog />
        <RunPanel />
        <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />

        <main key={path} className="anim-fade-in">
          {detail?.[1] ? (
            <DetailRoute name={safeDecode(detail[1])} />
          ) : page?.[1] ? (
            <PageRoute slug={safeDecode(page[1])} />
          ) : flow?.[1] ? (
            <FlowRoute slug={safeDecode(flow[1])} />
          ) : section === "pages" ? (
            <PagesRoute />
          ) : section === "flows" ? (
            <FlowsRoute />
          ) : (
            <LibraryRoute />
          )}
        </main>
      </div>
    </>
  );
}
