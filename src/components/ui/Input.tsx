"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "underline" | "contained";
}

export default function Input({ variant = "contained", className = "", ...props }: InputProps) {
  const base =
    "w-full px-4 py-3 text-base text-ink placeholder:text-ash-text outline-none transition-colors";

  const variants = {
    underline:
      "bg-transparent border-b border-field-border rounded-none focus:border-graphite",
    contained:
      "bg-chalk-card border border-field-border rounded-lg focus:border-graphite",
  };

  return (
    <input className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
