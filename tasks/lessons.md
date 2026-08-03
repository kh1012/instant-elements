# Lessons

## 리다이렉트 검증은 "검증된 값이 드러나는 지점"에서 재라

**증상** — Supabase 리다이렉트 허용목록이 열려 있다고 이틀간 잘못 보고했다. 근거는
`/auth/v1/authorize?...&redirect_to=https://evil.example/x` 응답에 `evil.example` 이
그대로 보인다는 것이었다. 사용자가 설정을 고친 뒤에도 계속 보여서 들통났다.

**원인** — GoTrue 의 `/authorize` 는 `provider`·`scopes`·`code_challenge` 만 걷어내고
**남은 쿼리 파라미터를 전부 provider authorize URL 에 그대로 붙인다.** `redirect_to` 도
그중 하나라 에코될 뿐이고, GitHub 은 모르는 파라미터를 무시한다. 실제 콜백은
`redirect_uri` 로 고정돼 있다. 검증을 통과한 리다이렉트 값은 `state` 뒤(flow state)에
숨어서 **URL 에 아예 나타나지 않는다.**

즉 나는 검증 결과가 나타나지 않는 지점을 들여다보며 "검증이 없다"고 결론지었다.
관측되지 않는 것을 부재의 증거로 쓴 것이다.

**제대로 된 측정** — 검증된 값으로 실제 302 를 쏘는 엔드포인트를 쓴다.
`/auth/v1/verify` 는 가짜 토큰이면 오류 프래그먼트를 달아 **검증된 목적지로** 보낸다.

```bash
S=https://<ref>.supabase.co
for R in "https://evil.example/x" "https://<real-host>/auth/callback" "http://127.0.0.1:9339/auth/callback"; do
  curl -s -o /dev/null -w "%{redirect_url}\n" \
    "$S/auth/v1/verify?token=bogus&type=magiclink&redirect_to=$(printf %s "$R" | jq -sRr @uri)"
done
```

차단되면 Site URL 로 강등되고, 허용되면 그대로 간다.

**규칙**

1. 보안 통제가 "없다"고 말하기 전에, **그 통제가 동작했다면 무엇이 달라 보일지**를 먼저
   적어라. 통과/차단이 같은 화면으로 보이는 지점이라면 그건 측정 지점이 아니다.
2. 차단 케이스 하나만 재지 말고 **통과 케이스를 대조군으로 같이 재라.** A만 보면
   "원래 저기로 가나?"와 구분되지 않는다. B·C 가 통과해야 A의 강등이 검증 때문임이
   확정된다.
3. 파라미터가 응답에 보인다는 사실은 그 파라미터가 **쓰인다**는 뜻이 아니다.
   프록시·리다이렉터는 모르는 파라미터를 통과시키는 게 기본 동작이다.

---

## 커밋할 때 새 import 의 대상 파일이 추적되는지 확인하라

**증상** — Vercel 빌드가 `Module not found: '@/lib/supabase/server'` 로 깨졌다.

**원인** — 커밋에 포함한 라우트가 아직 `git add` 되지 않은 새 파일을 import 했다.
로컬에서는 파일이 디스크에 있으니 빌드가 통과한다. 개별 스테이징(`git add -A` 금지)의
대가로 생기는 실패 모드다.

**규칙** — 커밋 직후 `git show HEAD:<import 대상 경로>` 로 확인하거나, 새 파일이 여럿인
변경은 **깨끗한 worktree 에서 `npm ci && npm run build`** 를 한 번 돌린다.
