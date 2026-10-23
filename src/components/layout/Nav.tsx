"use client";

import Link from "next/link";
import Image from "next/image";
import { METRICS } from "@/lib/metrics";
import Menu, { MenuItem } from "@/components/ui/Menu";
import {
  RiUserLine,
  RiFileTextLine,
  RiTimerLine,
  RiTimerFlashLine,
  RiShieldUserLine,
  RiSettings3Line,
  RiSlideshowLine,
  RiBarChart2Line,
  RiLockLine,
  RiLockUnlockLine,
  RiToolsLine,
  RiArrowDownSLine,
  RiDashboardLine,
} from "react-icons/ri";

interface NavProps {
  sessionTitle?: string;
  sessionCode?: string;
  sessionId?: string;
  participantCount?: number;
  isAdmin?: boolean;
  /** 보드 화면처럼 화면 전체 폭을 쓰는 페이지 */
  wide?: boolean;
  onOpenModeration?: () => void;
  onOpenPolls?: () => void;
  onOpenTimer?: () => void;
  /** 보드 잠금 상태 (admin 토글 버튼 표시용) */
  isLocked?: boolean;
  onToggleLock?: () => void;
}

const iconButton =
  "touch-target inline-flex items-center justify-center gap-1.5 h-10 min-w-10 px-2.5 rounded-full text-sm text-slate-text hover:text-graphite hover:bg-vellum transition-colors cursor-pointer";

export default function Nav({
  sessionTitle,
  sessionCode,
  sessionId,
  participantCount,
  isAdmin,
  wide = false,
  onOpenModeration,
  onOpenPolls,
  onOpenTimer,
  isLocked,
  onToggleLock,
}: NavProps) {
  // 강사 도구 — 기존 기능을 하나의 메뉴로 묶음 (요구사항 4.2, OBS-03)
  const instructorTools: MenuItem[] = sessionId && isAdmin
    ? [
        ...(onOpenTimer
          ? [{ key: "timer", label: "타이머", icon: <RiTimerFlashLine size={16} />, onSelect: onOpenTimer }]
          : []),
        {
          key: "instructor",
          label: "강사 진행 화면 (새 창)",
          icon: <RiDashboardLine size={16} />,
          href: `/board/${sessionId}/instructor`,
          external: true,
        },
        {
          key: "projector",
          label: "프로젝터 화면 (새 창)",
          icon: <RiSlideshowLine size={16} />,
          href: `/board/${sessionId}/projector`,
          external: true,
        },
        { key: "report", label: "보고서", icon: <RiFileTextLine size={16} />, href: `/admin/report/${sessionId}` },
        ...(onOpenModeration
          ? [{ key: "moderation", label: "모더레이션 (공지·금칙어·차단)", icon: <RiShieldUserLine size={16} />, onSelect: onOpenModeration }]
          : []),
        ...(onToggleLock
          ? [
              {
                key: "lock",
                label: isLocked ? "보드 잠금 해제" : "보드 잠금 (교육생 열람만)",
                icon: isLocked ? <RiLockUnlockLine size={16} /> : <RiLockLine size={16} />,
                onSelect: onToggleLock,
                active: !!isLocked,
              },
            ]
          : []),
        { key: "admin", label: "세션 관리 화면", icon: <RiSettings3Line size={16} />, href: "/admin" },
      ]
    : [];

  return (
    <nav className="h-16 shrink-0 bg-chalk-card/90 backdrop-blur border-b border-silver-mist">
      <div
        className={`h-full mx-auto w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 ${
          wide ? "" : "max-w-[1200px]"
        }`}
      >
        <Link
          href="/"
          aria-label="padolet 홈"
          className="shrink-0 flex items-center gap-2 font-brand text-xl tracking-tight text-graphite rounded-md"
          style={{ fontWeight: 700 }}
        >
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-md" />
          <span className={sessionCode ? "hidden lg:inline" : ""}>padolet</span>
        </Link>

        {sessionCode && (
          <span
            className="shrink-0 text-sm font-mono font-bold tracking-[0.15em] text-graphite px-2.5 py-1 rounded-full bg-linen"
            aria-label={`입장 코드 ${sessionCode}`}
          >
            {sessionCode}
          </span>
        )}

        {sessionTitle && (
          <span className="min-w-0 truncate text-sm font-semibold text-ink" title={sessionTitle}>
            {sessionTitle}
          </span>
        )}

        <div className="ml-auto shrink-0 flex items-center gap-0.5 sm:gap-1">
          {typeof participantCount === "number" && (
            <span
              className="inline-flex items-center gap-1 px-2 text-sm text-slate-text"
              title={`${METRICS.cumulative.label} ${participantCount}명 — ${METRICS.cumulative.help}`}
              aria-label={`${METRICS.cumulative.label} ${participantCount}명`}
              role="img"
            >
              <RiUserLine size={16} aria-hidden />
              <span aria-hidden>{participantCount}</span>
            </span>
          )}

          {sessionId && onOpenPolls && (
            <button onClick={onOpenPolls} className={iconButton} title="투표 / 퀴즈" aria-label="투표 / 퀴즈">
              <RiBarChart2Line size={18} aria-hidden />
              <span className="hidden md:inline">투표</span>
            </button>
          )}

          {sessionId && (
            <Link href={`/timer?back=/board/${sessionId}`} className={iconButton} aria-label="쉬는시간 타이머">
              <RiTimerLine size={18} aria-hidden />
              <span className="hidden md:inline">쉬는시간</span>
            </Link>
          )}

          {instructorTools.length > 0 && (
            <Menu
              label="강사 도구"
              items={instructorTools}
              triggerClassName={`${iconButton} ${isLocked ? "text-terracotta" : ""} border border-silver-mist`}
              trigger={
                <>
                  {isLocked ? <RiLockLine size={18} aria-hidden /> : <RiToolsLine size={18} aria-hidden />}
                  <span className="hidden md:inline">강사 도구</span>
                  <RiArrowDownSLine size={16} aria-hidden className="hidden md:inline" />
                </>
              }
            />
          )}

          {isAdmin && !sessionId && (
            <Link href="/admin" title="세션 관리" aria-label="세션 관리 화면으로 이동" className={iconButton}>
              <RiSettings3Line size={18} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
