"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// 운영 빌드(Vercel)에서는 import 자체가 일어나지 않아 학습자 화면에 노출되지 않음.
// dev 환경에서만 클라이언트 사이드에서 동적으로 로드.
const AgentationLazy = dynamic(
  () => import("agentation").then((m) => ({ default: m.Agentation })),
  { ssr: false }
);

/**
 * Dev 환경 전용 시각적 피드백 툴바.
 * - process.env.NODE_ENV === "development" 일 때만 마운트
 * - dynamic + ssr:false 로 SSR/RSC 트리에서 분리
 */
export default function AgentationToolbar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setMounted(true);
    }
  }, []);

  if (!mounted) return null;
  return <AgentationLazy />;
}
