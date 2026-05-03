"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "filled" | "ghost" | "outlined";
  children: ReactNode;
}

export default function Button({ variant = "filled", children, className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    filled:
      "bg-graphite text-chalk-card hover:bg-graphite-dark border border-transparent",
    outlined:
      "bg-transparent text-graphite border border-graphite hover:bg-vellum",
    ghost:
      "bg-chalk-card text-ink border border-silver-mist shadow-[--shadow-button] hover:bg-vellum",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
