/**
 * 클래스 이름 합치기.
 *
 * 의존성 없이 truthy 한 값만 이어 붙인다. Tailwind 유틸이 서로 충돌할 때(예: p-2 와 p-4)
 * 나중 값이 이기게 하려면 아래처럼 tailwind-merge 로 바꾸면 된다:
 *
 *   npm i clsx tailwind-merge
 *
 *   import { clsx, type ClassValue } from "clsx";
 *   import { twMerge } from "tailwind-merge";
 *   export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
 */
export type ClassValue = string | number | null | false | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
