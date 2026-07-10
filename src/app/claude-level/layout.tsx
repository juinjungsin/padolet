import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "클로드 레벨 측정 | padolet",
  description:
    "Claude Academy의 AI Fluency 프레임워크(4D)에 기반해 클로드 활용 역량을 적응형 문항으로 진단합니다.",
};

export default function ClaudeLevelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
