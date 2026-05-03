// 외부 URL을 화면에 렌더하거나 window.open / <a href>에 사용할 때 안전한지 검증
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeExternalUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

// 내부 라우팅용 — 반드시 / 로 시작하는 상대 경로만 허용 (open redirect 차단)
export function isSafeInternalPath(input: string | null | undefined): boolean {
  if (!input) return false;
  // // 또는 /\ 로 시작하면 protocol-relative URL — 외부 도메인으로 redirect 가능
  if (input.startsWith("//") || input.startsWith("/\\")) return false;
  return input.startsWith("/");
}
