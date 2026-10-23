"use client";

import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/** style은 포스트잇 색상 태그 등 인라인 배경에 사용. 그 외 div 속성(data-*, aria-*)도 그대로 전달 */
export default function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`bg-chalk-card border border-silver-mist rounded-lg shadow-[--shadow-card] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
