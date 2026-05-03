"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "underline" | "contained";
}

export default function Input({ variant = "contained", className = "", ...props }: InputProps) {
  const base =
    "w-full px-4 py-3 text-sm text-ink placeholder:text-ash-text outline-none transition-colors";

  const variants = {
    underline:
      "bg-transparent border-b border-ink rounded-none focus:border-graphite",
    contained:
      "bg-chalk-card border border-silver-mist rounded-md focus:border-graphite",
  };

  return (
    <input className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
