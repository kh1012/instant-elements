/**
 * stdout 청크를 줄 단위로 자른다.
 *
 * 이 파일이 따로 있는 이유: **청크 경계가 줄 경계와 일치하지 않는다.** 커널이 파이프를 채우는
 * 대로 잘라 주므로 JSON 한 줄이 청크 두 개에 걸쳐 도착하는 일이 흔하다. 그대로 파싱하면
 * 긴 출력에서만 간헐적으로 깨져 재현이 어려운 버그가 된다.
 *
 * 남은 조각을 상태로 들고 다음 청크 앞에 이어붙이는 게 전부지만, 그 경계 조건이 정확히
 * 이 함수가 지켜야 할 계약이라 순수 함수로 떼어 테스트한다.
 */
export function createLineBuffer(): { push(chunk: string): string[]; flush(): string[] } {
  let rest = "";

  return {
    /** 청크를 넣고 **완성된 줄만** 돌려준다. 마지막 조각은 다음 호출을 기다린다. */
    push(chunk: string): string[] {
      const merged = rest + chunk;
      const parts = merged.split("\n");
      // 마지막 조각은 아직 줄이 끝났다는 증거(\n)가 없다 — 다음 청크에 이어붙인다.
      rest = parts.pop() ?? "";
      return parts.filter((line) => line.trim() !== "");
    },

    /** 스트림이 끝났다. 개행 없이 남은 마지막 줄을 흘려보낸다. */
    flush(): string[] {
      const last = rest.trim();
      rest = "";
      return last === "" ? [] : [last];
    },
  };
}
