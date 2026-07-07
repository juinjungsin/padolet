// 혼동 문자 제외: 0/O, 1/I/L
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * 세션 입장 코드 생성.
 *
 * 보안 배경
 * - Math.random()은 예측 가능한 PRNG. 시드 유출/추론 시 다음 코드 예측 가능.
 * - crypto.getRandomValues는 CSPRNG로 예측 불가능.
 * - Uint32Array로 뽑고 CHARS.length(31)로 modulo. 편향은 2^32 % 31 = 20 에서 유래하지만
 *   각 값의 확률 편차가 8e-9 수준으로 실용상 무시 가능.
 *
 * 실행 환경
 * - 브라우저: window.crypto (globalThis.crypto)
 * - Node.js 18+: globalThis.crypto (WebCrypto 표준)
 */
export function generateSessionCode(): string {
  const arr = new Uint32Array(6);
  crypto.getRandomValues(arr);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS[arr[i] % CHARS.length];
  }
  return code;
}

export function isValidCode(code: string): boolean {
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code.toUpperCase());
}
