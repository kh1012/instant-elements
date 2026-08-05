/**
 * 전역 토스트 — 커스텀 이벤트만 쏜다.
 *
 * 함수 호출이 아니라 이벤트인 이유: 토스트를 띄우고 싶은 곳은 라우트·lib·API 래퍼 어디든인데,
 * React 컨텍스트로 만들면 lib 에서 못 부르고 싱글턴 객체로 만들면 그 모듈이 트리 밖에서
 * 렌더러를 붙들게 된다. 이벤트는 양쪽 다 피한다 — 부르는 쪽은 `window` 만 알면 되고,
 * 받는 쪽(`ToastHost`)은 평범한 컴포넌트로 남는다.
 */

/**
 * `default` 는 중립(끝났다는 확인만). `warning` 은 막혔거나 주의가 필요한 것,
 * `error` 는 실패한 것 — 뒤 둘은 읽을 시간이 더 필요해 기본 지속시간이 길다.
 */
export type ToastVariant = "default" | "warning" | "error";

export const TOAST_EVENT = "instant-elements-toast";

export interface ToastDetail {
  message: string;
  variant?: ToastVariant;
  /** ms. 생략하면 variant 별 기본값(`ToastHost`). */
  duration?: number;
}

export function toast(message: string, options?: Omit<ToastDetail, "message">): void {
  try {
    window.dispatchEvent(
      new CustomEvent<ToastDetail>(TOAST_EVENT, {
        detail: {
          message,
          ...(options?.variant ? { variant: options.variant } : {}),
          ...(options?.duration ? { duration: options.duration } : {}),
        },
      }),
    );
  } catch {
    // window 가 없는 환경(테스트·SSR). 토스트를 못 띄우는 게 호출부를 죽일 이유는 아니다.
  }
}
