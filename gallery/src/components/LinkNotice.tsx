import { useEffect, useState } from "react";

/** 콜백이 붙여 보내는 결과와 사람이 읽을 문장. */
const MESSAGES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  "1": { tone: "ok", text: "마켓플레이스 계정과 연결했습니다." },
  denied: {
    tone: "bad",
    text: "연결 요청이 만료됐거나 이 갤러리가 시작한 것이 아닙니다. 다시 시도해 주세요.",
  },
  invalid: { tone: "bad", text: "돌려받은 계정 정보를 알아볼 수 없어 저장하지 않았습니다." },
};

/**
 * 로그인 후 돌아왔을 때의 결과 알림.
 *
 * 성공은 아바타가 바뀌는 것으로도 보이지만, **실패는 아무 일도 안 일어난 것처럼 보인다** —
 * 로그인까지 하고 돌아왔는데 이름이 그대로면 무엇이 잘못됐는지 알 길이 없다.
 */
export function LinkNotice() {
  const [notice, setNotice] = useState<(typeof MESSAGES)[string] | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const linked = url.searchParams.get("linked");
    if (!linked) return;

    setNotice(MESSAGES[linked] ?? null);

    /*
     * 주소에서 지운다. 남겨 두면 새로고침할 때마다 같은 알림이 다시 뜨고, 링크를 복사해 준
     * 사람에게도 "연결됐습니다"가 뜬다.
     */
    url.searchParams.delete("linked");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  if (!notice) return null;

  return (
    <div className="flex justify-center px-6 pb-2">
      <p
        role="status"
        className={
          notice.tone === "ok"
            ? "anim-fade-in rounded-full border border-st-border bg-st-muted px-4 py-1.5 text-step-n2 text-st-foreground"
            : "anim-fade-in rounded-full border border-st-destructive/40 bg-st-destructive/10 px-4 py-1.5 text-step-n2 text-st-destructive"
        }
      >
        {notice.text}
        <button
          type="button"
          onClick={() => setNotice(null)}
          aria-label="알림 닫기"
          className="ml-3 opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      </p>
    </div>
  );
}
