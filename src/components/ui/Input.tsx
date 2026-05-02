"use client";

import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "underline" | "contained";
}

export default function Input({ variant = "contained", className = "", ...props }: InputProps) {
  const base = "w-full px-5 py-3 text-sm text-obsidian placeholder:text-slate outline-none";

  const variants = {
    underline: "bg-transparent border-b border-obsidian rounded-none",
    contained: "bg-white border border-chalk rounded-none shadow-[--shadow-subtle]",
  };

  return (
    <input className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}
