"use client";

import Link from "next/link";
import { RiUserLine } from "react-icons/ri";

interface NavProps {
  sessionTitle?: string;
  participantCount?: number;
  isAdmin?: boolean;
}

export default function Nav({ sessionTitle, participantCount, isAdmin }: NavProps) {
  return (
    <nav className="h-9 border-b border-chalk bg-eggshell flex items-center px-6 max-w-[1200px] mx-auto w-full">
      <Link href="/" className="font-display text-lg tracking-tight text-obsidian" style={{ fontWeight: 300 }}>
        padolet
      </Link>

      {sessionTitle && (
        <span className="ml-4 text-sm text-gravel truncate">{sessionTitle}</span>
      )}

      <div className="ml-auto flex items-center gap-3">
        {typeof participantCount === "number" && (
          <div className="flex items-center gap-1 text-sm text-gravel">
            <RiUserLine size={14} />
            <span>{participantCount}</span>
          </div>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className="text-xs text-gravel hover:text-obsidian transition-colors"
          >
            관리
          </Link>
        )}
      </div>
    </nav>
  );
}
