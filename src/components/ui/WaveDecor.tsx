"use client";

/**
 * 파도 장식 SVG — 페이지 하단에 겹겹이 밀려오는 반투명 파도.
 * 순수 장식 요소 (aria-hidden). 부모에 relative가 필요.
 */
export default function WaveDecor({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="w-full h-[140px] md:h-[200px] block"
      >
        {/* 가장 먼 파도 */}
        <path
          d="M0,96 C240,160 480,32 720,80 C960,128 1200,64 1440,112 L1440,220 L0,220 Z"
          fill="#2e77e5"
          opacity="0.08"
        />
        {/* 중간 파도 */}
        <path
          d="M0,144 C280,88 520,184 760,136 C1000,88 1240,168 1440,128 L1440,220 L0,220 Z"
          fill="#1c3d5a"
          opacity="0.10"
        />
        {/* 가장 가까운 파도 */}
        <path
          d="M0,184 C320,140 600,208 880,176 C1120,150 1300,196 1440,172 L1440,220 L0,220 Z"
          fill="#2e77e5"
          opacity="0.14"
        />
      </svg>
    </div>
  );
}

/** 제목 아래 등에 쓰는 작은 물결 밑줄 */
export function WaveUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 12"
      className={`h-3 w-28 ${className}`}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M2 8 C12 2, 22 2, 32 8 C42 14, 52 14, 62 8 C72 2, 82 2, 92 8 C102 14, 112 14, 118 8"
        stroke="#2e77e5"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
