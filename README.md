# instant-elements

> 코딩 에이전트 기반 UI 하네스 — **설명하면 만들어지고, 갤러리에서 보이고, 수정 프롬프트로 고쳐지고, 모든 변경이 기록된다.**

컴포넌트를 만들 때마다 레지스트리에 쌓이고, 쌓인 컴포넌트로 페이지를 조립하고, 조립한 페이지를 이어 붙여 화면 전환까지 시연한다. 디자인 일관성은 시맨틱 토큰(`st-*`)이 지킨다.

```
설명한다  →  /element-create  →  3파일 + 레지스트리 엔트리
                                      ↓
                              갤러리에서 본다 (:9221)
                                      ↓
                     수정 프롬프트 복사 → 에이전트가 고친다
                                      ↓
                        히스토리에 기록된다 (누가·언제·무엇을·어떤 커밋)
                                      ↓
                    /page-create → 페이지 조립 → 피드백 → 흐름 시연
```

## 상태

🚧 **알파 개발 중** — 단계적으로 공개됩니다. 기본 설치(`latest`)는 아직 플레이스홀더이며, 진행 중인 빌드는 `alpha` 태그로 받습니다.

```bash
npm install instant-elements@alpha
```

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| Phase 1 | 설정 · CLI · 레지스트리 · 토큰 · 갤러리(라이브러리/상세) · `element-create` 스킬 | 진행 중 |
| Phase 2 | 페이지 조립(`page-create`) · 노드 지목 피드백 | 예정 |
| Phase 3 | 흐름 시연 · git SHA 복원 · 애니메이션 계약 · props 스키마 추출 | 예정 |
| Phase 4 | 문서 · 예제 앱 · `1.0.0` | 예정 |

## 요구 사항

- Node.js **20.11** 이상
- React 19 · Tailwind CSS v4 (소비 프로젝트)
- git (선택 — 히스토리 작성자와 복원 지점이 여기서 옵니다)

## 지금 쓸 수 있는 것

```bash
npx ie doctor        # 환경·프로젝트 점검
npx ie --version
npx ie help
```

## 설정

```ts
// instant.config.ts
import { defineConfig } from "instant-elements/config";

export default defineConfig({
  elementsDir: "src/elements",       // 컴포넌트 3파일이 사는 곳
  importAlias: "@/elements",         // 앱에서 import 하는 경로
  registryDir: ".instant/registry",  // 엔트리 · 인덱스 · 히스토리
  pagesDir: ".instant/pages",
  flowsDir: ".instant/flows",
  tokens: { css: "instant-elements/theme.css" },
  gallery: { port: 9221 },
});
```

경로는 전부 설정에서 나온다 — CLI도 갤러리도 스킬도 경로를 하드코딩하지 않고 `ie config --json` 이 내놓는 해석된 절대경로만 본다.

## 라이선스

MIT © kh1012
