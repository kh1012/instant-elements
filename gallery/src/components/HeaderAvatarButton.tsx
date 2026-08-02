import { useRef, useState } from "react";
import galleryConfig from "virtual:ie/config";
import { useIdentity } from "../lib/identity";
import { Avatar } from "./Avatar";
import { Popover } from "./Popover";
import { Tooltip } from "./Tooltip";

/**
 * 헤더 우측의 나.
 *
 * 아바타 하나가 "지금 무슨 이름으로 기록되는가"를 늘 보여 준다 — 그걸 모르면 히스토리에 엉뚱한
 * 이름이 쌓인 뒤에야 알게 된다.
 *
 * ── 잔액을 여기서 안 보여 주는 이유
 * 잔액은 마켓플레이스 세션에 속한 값이다. 갤러리가 그걸 알려면 로그인 이름으로 잔액을 묻는
 * 무인증 API 를 열어야 하는데, 그건 남의 잔액도 물어볼 수 있다는 뜻이다. 링크만 건다.
 */
export function HeaderAvatarButton({ onEdit }: { onEdit: () => void }) {
  const { identity, gitUserName, loading } = useIdentity();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  // 이름이 정해지기 전에도 자리는 지킨다 — 뒤늦게 나타나면 헤더가 한 번 흔들린다.
  const displayName = identity?.nickname ?? gitUserName ?? "이름 없음";

  return (
    <>
      <Tooltip content={loading ? "신원 확인 중" : displayName}>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`내 신원 — ${displayName}`}
          aria-expanded={open}
          className="press grid size-8 shrink-0 place-items-center rounded-full"
        >
          {loading ? (
            <span className="size-8 animate-pulse rounded-full bg-st-muted" />
          ) : (
            <Avatar name={displayName} src={identity?.avatarUrl} size="md" />
          )}
        </button>
      </Tooltip>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} label="내 신원">
        <div className="w-64 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={displayName} src={identity?.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-step-n1 font-medium">{displayName}</p>
              <p className="truncate text-step-n2 text-st-muted-foreground">
                {identity
                  ? identity.login
                    ? `${identity.login} · ${identity.provider}`
                    : "이 컴퓨터에만 저장됨"
                  : gitUserName
                    ? "git 설정으로 대체 중"
                    : "아직 정하지 않았습니다"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-0.5 border-t border-st-border pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="rounded-md px-2 py-1.5 text-left text-step-n1 hover:bg-st-muted"
            >
              {identity ? "신원 바꾸기" : "신원 정하기"}
            </button>
            <a
              href={galleryConfig.publishUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md px-2 py-1.5 text-step-n1 hover:bg-st-muted"
            >
              마켓플레이스에서 잔액 보기 ↗
            </a>
          </div>
        </div>
      </Popover>
    </>
  );
}
