import { useEffect, useState } from "react";
import { useIdentity } from "../lib/identity";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { GithubIcon, GoogleIcon } from "./icons";

/**
 * 첫 진입에서 "당신은 누구인가"를 묻는다.
 *
 * 히스토리에 남는 이름이 git `user.name` 하나뿐이면, 한 레포를 여럿이 쓰거나 git 설정이 회사
 * 계정으로 박혀 있을 때 기록이 전부 같은 사람 것처럼 보인다. 여기서 한 번 정하면 갤러리와
 * CLI 가 같은 이름을 쓴다.
 *
 * ── 왜 로그인 없이 지나갈 수 있나
 * 이건 **로컬 개발 도구**다. 비행기에서든 사내망에서든 떠야 한다. 로그인을 강제하면 마켓플레이스가
 * 잠깐 죽었을 때 사람들의 갤러리도 같이 죽는다. 로그인은 마켓플레이스와 이을 때만 필요하다.
 */
export function IdentityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { identity, gitUserName, save, startLink } = useIdentity();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열 때마다 현재 값에서 시작한다 — 이름을 바꾸러 열었는데 빈칸이면 처음부터 다시 쳐야 한다.
  useEffect(() => {
    if (open) {
      setName(identity?.nickname ?? gitUserName ?? "");
      setError(null);
    }
  }, [open, identity?.nickname, gitUserName]);

  const run = (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    void task()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    run(async () => {
      await save(trimmed);
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={identity ? "신원 바꾸기" : "어떤 이름으로 기록할까요?"}
      description="컴포넌트를 만들거나 고칠 때 히스토리에 남는 이름입니다."
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Avatar name={name || "?"} src={identity?.avatarUrl} size="lg" />
          <div className="min-w-0 text-step-n2 text-st-muted-foreground">
            {identity?.login ? (
              <>
                <span className="text-st-foreground">{identity.login}</span> 으로 연결됨
                <span className="ml-1 opacity-70">({identity.provider})</span>
              </>
            ) : (
              "로그인하면 아바타가 함께 들어옵니다."
            )}
          </div>
        </div>

        {/* 로그인 — 계정을 만들고 아바타까지 가져오는 길. */}
        <div className="flex flex-col gap-2">
          <Button variant="outline" disabled={busy} onClick={() => run(() => startLink("github"))} className="justify-start">
            <GithubIcon />
            GitHub 으로 계속하기
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => run(() => startLink("google"))} className="justify-start">
            <GoogleIcon />
            Google 로 계속하기
          </Button>
          <p className="text-step-n2 text-st-muted-foreground">
            마켓플레이스로 이동해 로그인한 뒤 이 갤러리로 돌아옵니다. 토큰 잔액과 발행이 이
            계정에 묶입니다.
          </p>
        </div>

        <div className="flex items-center gap-3 text-step-n2 text-st-muted-foreground">
          <span className="h-px flex-1 bg-st-border" />
          또는
          <span className="h-px flex-1 bg-st-border" />
        </div>

        {/* 로그인 없이 — 오프라인에서도 도구가 떠야 한다. */}
        <div className="flex flex-col gap-2">
          <label htmlFor="identity-nickname" className="text-step-n1 font-medium">
            이름만 정하기
          </label>
          <div className="flex gap-2">
            <input
              id="identity-nickname"
              value={name}
              maxLength={60}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder={gitUserName ?? "표시할 이름"}
              className="min-w-0 flex-1 rounded-md border border-st-border bg-st-background px-3 text-step-n1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-ring"
            />
            <Button variant="primary" disabled={busy || !name.trim()} onClick={submit}>
              저장
            </Button>
          </div>
        </div>

        {error ? <p className="text-step-n2 text-st-destructive">{error}</p> : null}

        {/*
          닫는 길을 항상 열어 둔다. 저장하지 않으면 git 이름(또는 unknown)으로 기록되고,
          다음에 열 때 이 창이 다시 뜬다 — "다시 보지 않기"를 두지 않는 이유다.
        */}
        <button
          type="button"
          onClick={onClose}
          className="self-center text-step-n2 text-st-muted-foreground underline-offset-2 hover:underline"
        >
          나중에 하기
        </button>
      </div>
    </Dialog>
  );
}
