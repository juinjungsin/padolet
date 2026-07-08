"use client";

import { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** 배경색 등 인라인 스타일 (포스트잇 색상 태그용) */
  style?: CSSProperties;
}

export default function Card({ children, className = "", style }: CardProps) {
  return (
    <div
      className={`bg-chalk-card border border-silver-mist rounded-lg shadow-[--shadow-card] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
