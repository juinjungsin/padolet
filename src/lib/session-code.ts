// 혼동 문자 제외: 0/O, 1/I/L
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const CODE_LENGTH = 4;

export function generateSessionCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// 4자리(신규) + 6자리(기존 세션) 모두 허용 — 하위 호환
export function isValidCode(code: string): boolean {
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4,6}$/.test(code.toUpperCase());
}
