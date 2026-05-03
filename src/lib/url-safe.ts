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

// 내부 라우팅 화이트리스트 — 명시적으로 알려진 경로만 허용 (open redirect 완전 차단)
const ALLOWED_INTERNAL_PATHS = ["/", "/admin"] as const;
const ALLOWED_INTERNAL_PREFIXES = ["/board/", "/admin/report/"] as const;

export function isSafeInternalPath(input: string | null | undefined): boolean {
  if (!input) return false;
  // protocol-relative (//evil.com, /\evil.com) 차단
  if (input.startsWith("//") || input.startsWith("/\\")) return false;
  // 절대 URL (https://...) 차단 — startsWith("/")만으로는 부족
  if (!input.startsWith("/")) return false;

  // 정확 매칭 또는 등록된 prefix만 허용
  if ((ALLOWED_INTERNAL_PATHS as readonly string[]).includes(input)) return true;
  return ALLOWED_INTERNAL_PREFIXES.some((p) => input.startsWith(p));
}
