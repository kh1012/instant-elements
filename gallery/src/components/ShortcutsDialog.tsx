import { useEffect, useState } from "react";
import { isTyping, SHORTCUTS } from "../lib/shortcuts";
import { Dialog } from "./Dialog";

/**
 * 단축키 목록 (`?`).
 *
 * 단축키는 **있는 줄 몰라서** 안 쓰인다. 툴팁이 하나씩 알려 주긴 하지만, 그건 이미 그 버튼을
 * 찾아간 사람에게만 보인다. 한 번에 훑을 자리가 따로 있어야 한다.
 *
 * 목록은 `lib/shortcuts.ts` 하나에서 온다 — 여기 손으로 적어 두면 키를 바꿨을 때 이 화면만
 * 옛말을 하게 된다.
 */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // `?` 는 Shift+/ 다. 글을 쓰는 중이면 그냥 물음표여야 한다.
      if (event.key !== "?" || isTyping(event.target)) return;
      event.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="단축키"
      description="입력창에 글을 쓰는 중에는 글자 단축키(/, ?)가 동작하지 않습니다."
    >
      <dl className="divide-y divide-st-border">
        {Object.values(SHORTCUTS).map((shortcut) => (
          <div key={shortcut.aria} className="flex items-center justify-between gap-4 py-2">
            <dt className="text-step-n1">{shortcut.label}</dt>
            <dd>
              <kbd className="rounded border border-st-border bg-st-muted px-1.5 py-0.5 text-step-n2">
                {shortcut.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
