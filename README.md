# instant-elements

> 코딩 에이전트 기반 UI 하네스 — **설명하면 만들어지고, 갤러리에서 보이고, 수정 프롬프트로 고쳐지고, 모든 변경이 기록된다.**

컴포넌트를 만들 때마다 레지스트리에 쌓이고, 다음 요청에서는 **새로 만들기 전에 이미 있는 것을 먼저 추천**한다. 디자인 일관성은 시맨틱 토큰(`st-*`)이 지킨다.

```
"대시보드에 쓸 지표 카드 만들어줘"
        ↓  에이전트가 재사용을 먼저 찾는다
        ↓  없으면 3파일 + 레지스트리 엔트리를 만든다
   갤러리에서 본다 (:9221)
        ↓  수정 프롬프트 복사 → 에이전트가 고친다
   기록된다 (누가 · 언제 · 무엇을 · 어떤 커밋)
        ↓
   쌓인 컴포넌트로 페이지를 조립한다 → 고칠 자리를 짚으면 반영 프롬프트가 나온다
```

## 상태

🚧 **알파 개발 중** — 단계적으로 공개됩니다. 진행 중인 빌드는 `alpha` 태그로 받습니다.

```bash
npm install -D instant-elements@alpha
```

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| Phase 1 | 설정 · CLI · 레지스트리 · 토큰 · 갤러리 · `element-create` 스킬 | ✅ |
| Phase 2 | 페이지 조립(`page-create`) · 노드 지목 피드백 | ✅ |
| Phase 3 | 흐름 시연 · git SHA 복원 · 애니메이션 계약 · props 스키마 추출 | 예정 |
| Phase 4 | 문서 · 예제 앱 · `1.0.0` | 예정 |

## 요구 사항

- Node.js **20.11** 이상
- React 18/19 · Tailwind CSS v4 (소비 프로젝트)
- git (선택 — 히스토리 작성자와 복원 지점이 여기서 옵니다)

## 시작하기

```bash
npx ie init            # 설정·디렉토리·유틸 스캐폴드
npx ie skills install  # 코딩 에이전트에 스킬 설치
```

`init` 이 안내하는 대로 Tailwind 진입 CSS 에 토큰을 연결하고:

```css
@import "tailwindcss";
@import "instant-elements/theme.css";
@source "./src/elements";
```

앱 루트에 스코프 속성을 붙입니다:

```html
<html data-instant data-theme="light">
```

이제 에이전트에게 말로 시키면 됩니다:

> "대시보드 상단에 쓸 지표 카드 만들어줘. 숫자랑 증감률 같이 보이게."

그리고 결과를 봅니다:

```bash
npx ie gallery         # http://127.0.0.1:9221
```

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `ie init` | 설정·디렉토리·`cn` 유틸·빈 인덱스를 만든다 |
| `ie skills install` | `.claude/skills` · `.agents/skills` 에 스킬 스텁을 설치한다 |
| `ie element new <name>` | 3파일 + 엔트리 + 생성 이력 + 인덱스를 한 번에 만든다 |
| `ie element list` | 재사용 후보를 찾는다 (`--query` · `--category` · `--json`) |
| `ie element get <name>` | 엔트리 + 히스토리 + 계약 검사 |
| `ie element log <name>` | 수정·추천 이력을 남긴다 (`--sha` 로 복원 지점 기록) |
| `ie page create "<제목>"` | 빈 페이지를 만든다 |
| `ie page get/set <slug>` | 페이지를 읽고 저장한다 (`--base` 로 동시성 안전) |
| `ie page catalog` | 조립 가능한 컴포넌트(데모 보유) |
| `ie gallery` | 컴포넌트 갤러리를 띄운다 |
| `ie index` | `index.json` 을 결정적으로 재생성한다 |
| `ie guide <skill>` | 스킬 정본 절차를 출력한다 |
| `ie config` | 해석된 설정과 경로 (`--json`) |
| `ie doctor` | 환경·프로젝트 점검 |

## 설정

```ts
// instant.config.ts
import type { InstantElementsConfig } from "instant-elements/config";

const config: InstantElementsConfig = {
  elementsDir: "src/elements",       // 컴포넌트 3파일이 사는 곳
  importAlias: "@/elements",         // 앱에서 import 하는 경로
  registryDir: ".instant/registry",  // 엔트리 · 인덱스 · 히스토리
  pagesDir: ".instant/pages",
  flowsDir: ".instant/flows",
  tokens: { css: "instant-elements/theme.css" },
  gallery: { port: 9221 },
};

export default config;
```

경로는 전부 설정에서 나옵니다 — CLI도 갤러리도 스킬도 경로를 하드코딩하지 않고 `ie config --json` 이 내놓는 해석된 절대경로만 봅니다.

**우리 디자인 시스템 토큰을 쓰려면** `styles/colors.css` 를 복사해 값만 바꾸고 `tokens.css` 를 그 파일로 가리키세요. 토큰 **이름**은 그대로 두어야 갤러리와 기존 컴포넌트가 계속 동작합니다.

## 설계 메모

- **갤러리는 소비 프로젝트의 컴포넌트 라이브러리에 의존하지 않습니다.** 도구가 자기 힘으로 떠야 "컴포넌트가 깨져서 컴포넌트를 못 보는" 순환이 생기지 않습니다.
- **레지스트리 인덱스는 결정적입니다.** 같은 엔트리면 출력이 바이트 단위로 같아, 재생성만으로 diff 가 나지 않습니다.
- **히스토리는 append-only 입니다.** 여러 writer 가 동시에 써도 라인이 섞이지 않습니다.
- **스킬 정본은 패키지 안에 하나뿐입니다.** 설치되는 건 스텁이고, 절차는 `ie guide` 로 매번 새로 읽습니다 — `npm update` 가 곧 지침 갱신입니다. 팀 규칙을 덧붙이려면 `.instant/skills/<name>/GUIDE.md` 를 두세요.

## 라이선스

MIT © kh1012
