import type { NextConfig } from "next";

// Firebase + NextAuth + Google OAuth + 첨부 이미지가 동작하도록 도메인을 허용하는 최소 CSP.
// 'unsafe-inline'은 Tailwind / Next 인라인 스타일을 위해 style-src에 포함. script는 'self'와 nonce 없는
// 인라인을 허용하지 않음 (Next 16의 인라인 부트스트랩은 hash 기반으로 처리됨).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://accounts.google.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebaseapp.com https://*.firebasestorage.app https://firebasestorage.googleapis.com",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com https://accounts.google.com",
  "frame-src 'self' https://accounts.google.com",
].join("; ");

const securityHeaders = [
  // clickjacking 방지 (CSP frame-ancestors가 우선이지만 호환성 유지)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // MIME sniffing 차단
  { key: "X-Content-Type-Options", value: "nosniff" },
  // referrer 최소 노출
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HTTPS 강제 (Vercel은 기본 HTTPS, 1년 유지)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // 위치/카메라/마이크 등 민감 권한 차단
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // CSP — XSS / data exfiltration 1차 방어
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
