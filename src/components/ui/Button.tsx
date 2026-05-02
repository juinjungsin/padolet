"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "filled" | "ghost";
  children: ReactNode;
}

export default function Button({ variant = "filled", children, className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    filled: "bg-obsidian text-eggshell shadow-[--shadow-button] hover:bg-cinder",
    ghost: "bg-white text-obsidian border border-chalk shadow-[--shadow-button] hover:bg-powder",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
