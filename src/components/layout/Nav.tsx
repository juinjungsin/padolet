"use client";

import Link from "next/link";
import Image from "next/image";
import {
  RiUserLine,
  RiFileTextLine,
  RiTimerLine,
  RiShieldUserLine,
  RiSettings3Line,
  RiSlideshowLine,
} from "react-icons/ri";

interface NavProps {
  sessionTitle?: string;
  sessionCode?: string;
  sessionId?: string;
  participantCount?: number;
  isAdmin?: boolean;
  onOpenModeration?: () => void;
}

export default function Nav({
  sessionTitle,
  sessionCode,
  sessionId,
  participantCount,
  isAdmin,
  onOpenModeration,
}: NavProps) {
  return (
    <nav className="h-[72px] bg-parchment flex items-center px-4 md:px-8 max-w-[1200px] mx-auto w-full">
      <Link
        href="/"
        className="flex items-center gap-2 font-display text-xl tracking-tight text-graphite"
        style={{ fontWeight: 700 }}
      >
        <Image src="/icon.png" alt="padolet" width={28} height={28} className="rounded-md" />
        padolet
      </Link>

      {sessionCode && (
        <span className="ml-4 text-sm font-mono font-bold tracking-[0.2em] text-graphite px-2.5 py-1 rounded-full bg-linen">
          {sessionCode}
        </span>
      )}

      {sessionTitle && (
        <span className="ml-3 text-sm text-slate-text truncate hidden sm:inline">{sessionTitle}</span>
      )}

      <div className="ml-auto flex items-center gap-4">
        {typeof participantCount === "number" && (
          <div className="flex items-center gap-1 text-sm text-slate-text">
            <RiUserLine size={14} />
            <span>{participantCount}</span>
          </div>
        )}

        {sessionId && (
          <Link
            href={`/timer?back=/board/${sessionId}`}
            className="inline-flex items-center gap-1 text-xs text-slate-text hover:text-graphite transition-colors"
          >
            <RiTimerLine size={14} />
            <span className="hidden sm:inline">쉬는시간</span>
          </Link>
        )}

        {sessionId && isAdmin && (
          <Link
            href={`/board/${sessionId}/projector`}
            target="_blank"
            rel="noopener noreferrer"
            title="프로젝터 모드 (새 창)"
            className="flex items-center gap-1 text-xs text-slate-text hover:text-graphite transition-colors"
          >
            <RiSlideshowLine size={14} />
            <span className="hidden sm:inline">프로젝터</span>
          </Link>
        )}

        {sessionId && isAdmin && (
          <Link
            href={`/admin/report/${sessionId}`}
            className="flex items-center gap-1 text-xs text-slate-text hover:text-graphite transition-colors"
          >
            <RiFileTextLine size={14} />
            <span className="hidden sm:inline">레포트</span>
          </Link>
        )}

        {isAdmin && onOpenModeration && (
          <button
            onClick={onOpenModeration}
            className="inline-flex items-center gap-1 text-xs text-slate-text hover:text-graphite transition-colors cursor-pointer"
          >
            <RiShieldUserLine size={14} />
            <span className="hidden sm:inline">모더레이션</span>
          </button>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            title="관리 페이지"
            aria-label="관리 페이지로 이동"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-slate-text hover:text-graphite hover:bg-vellum transition-colors"
          >
            <RiSettings3Line size={18} />
          </Link>
        )}
      </div>
    </nav>
  );
}
