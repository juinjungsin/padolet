"use client";

import Link from "next/link";
import Image from "next/image";
import { RiUserLine, RiFileTextLine } from "react-icons/ri";

interface NavProps {
  sessionTitle?: string;
  sessionCode?: string;
  sessionId?: string;
  participantCount?: number;
  isAdmin?: boolean;
}

export default function Nav({ sessionTitle, sessionCode, sessionId, participantCount, isAdmin }: NavProps) {
  return (
    <nav className="h-11 md:h-9 border-b border-chalk bg-eggshell flex items-center px-4 md:px-6 max-w-[1200px] mx-auto w-full">
      <Link href="/" className="flex items-center gap-1.5 font-display text-lg tracking-tight text-obsidian" style={{ fontWeight: 300 }}>
        <Image src="/icon.png" alt="padolet" width={24} height={24} className="rounded-md" />
        padolet
      </Link>

      {sessionTitle && (
        <span className="ml-4 text-sm text-gravel truncate hidden sm:inline">{sessionTitle}</span>
      )}

      <div className="ml-auto flex items-center gap-3">
        {sessionCode && (
          <span className="text-xs font-mono font-medium tracking-widest bg-powder px-2.5 py-1 rounded-full text-obsidian">
            {sessionCode}
          </span>
        )}

        {typeof participantCount === "number" && (
          <div className="flex items-center gap-1 text-sm text-gravel">
            <RiUserLine size={14} />
            <span>{participantCount}</span>
          </div>
        )}

        {sessionId && (
          <Link
            href={`/admin/report/${sessionId}`}
            className="flex items-center gap-1 text-xs text-gravel hover:text-obsidian transition-colors"
          >
            <RiFileTextLine size={14} />
            <span className="hidden sm:inline">레포트</span>
          </Link>
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
