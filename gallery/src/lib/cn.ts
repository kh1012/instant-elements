export type ClassValue = string | number | null | false | undefined;

/** 갤러리 크롬 전용 클래스 합치기. 의존성 0. */
export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
