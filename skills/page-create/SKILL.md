---
name: page-create
description: >
  레지스트리에 쌓인 컴포넌트로 페이지(화면) 초안을 조립하고 고도화한다. 개발자가 원하는 화면을
  말로 설명하면 뼈대를 조립하고, 자리표시를 실제 컴포넌트로 채워 완성한다. 결과는 페이지
  플레이그라운드에서 확인하고, 리뷰 피드백을 받아 반영한다.
  트리거 — "/page-create", "페이지 만들어줘", "이 화면 조립해줘", "와이어프레임 잡아줘",
  "이 페이지 고도화", "페이지 리뷰 피드백 반영". 다음에는 발동하지 않는다 — 컴포넌트 신규
  생성(element-create), 스타일과 무관한 순수 로직·데이터 작업, instant-elements 라이브러리 자체의 수정.
---

# page-create — 포인터 (정본은 GUIDE)

> ⚠️ **이 파일은 트리거 등록용 얇은 포인터다. 실제 절차와 규칙은 여기 없다.**
>
> 이 스킬이 발동하면 **작업을 시작하기 전에 반드시** 정본을 새로 열어 그대로 따른다:
>
> ```bash
> npx instant-elements guide page-create
> ```
>
> - 정본은 설치된 패키지 안에 있어 **`npm update instant-elements` 만으로 최신 지침을 받는다**.
> - 프로젝트가 `.instant/skills/page-create/GUIDE.md` 를 두면 그쪽이 정본이 된다(팀 규칙 추가).
> - GUIDE 를 못 읽으면 임의로 진행하지 말고 사용자에게 알리고 멈춘다.

한 줄 요약(정본 대체 아님): 컴포넌트는 만들지 않는다(없으면 `/element-create` 로 위임).
`npx instant-elements page get` → 편집 → `npx instant-elements page set --base <읽은 version>` 으로 저장한다. 통째로 덮어쓰지 않는다.
— **자세한 절차는 `npx instant-elements guide page-create`.**
