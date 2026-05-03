import type { NextConfig } from "next";

const securityHeaders = [
  // clickjacking 방지
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
