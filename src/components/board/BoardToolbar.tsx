"use client";

import { POST_COLORS, PostColor } from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { PostSortMode } from "./PostGrid";
import { RiSearchLine, RiCloseLine, RiTeamLine, RiQuestionLine, RiTimerFlashLine } from "react-icons/ri";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenParticipants: () => void;
  participantCount: number;
  sortMode: PostSortMode;
  onSortChange: (m: PostSortMode) => void;
  questionsOnly: boolean;
  onQuestionsOnlyChange: (v: boolean) => void;
  colorFilter: PostColor | null;
  onColorFilterChange: (c: PostColor | null) => void;
  /** admin 전용 — 세션 타이머 설정 모달 열기 */
  onOpenTimer?: () => void;
}

export default function BoardToolbar({
  searchQuery,
  onSearchChange,
  onOpenParticipants,
  participantCount,
  sortMode,
  onSortChange,
  questionsOnly,
  onQuestionsOnlyChange,
  colorFilter,
  onColorFilterChange,
  onOpenTimer,
}: Props) {
  return (
    <div className="px-4 py-2 border-b border-silver-mist flex items-center gap-2 flex-wrap">
      <div className="flex-1 min-w-[160px] relative">
        <RiSearchLine
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ash-text pointer-events-none"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="포스트잇 / 작성자 검색"
          className="w-full pl-[34px] pr-[32px] py-2 text-sm text-ink bg-vellum border border-silver-mist rounded-full outline-none focus:border-graphite"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-text hover:text-graphite cursor-pointer"
            aria-label="검색어 지우기"
          >
            <RiCloseLine size={14} />
          </button>
        )}
      </div>

      {/* 정렬 */}
      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as PostSortMode)}
        aria-label="포스트잇 정렬"
        className="px-3 py-2 text-xs text-ink bg-vellum border border-silver-mist rounded-full outline-none focus:border-graphite cursor-pointer"
      >
        <option value="default">등록순</option>
        <option value="latest">최신순</option>
        <option value="reactions">공감순</option>
      </select>

      {/* 질문 필터 (Q&A) */}
      <button
        onClick={() => onQuestionsOnlyChange(!questionsOnly)}
        className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
          questionsOnly
            ? "bg-graphite text-chalk-card border-graphite"
            : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
        }`}
        title="질문으로 등록된 포스트잇만 표시"
      >
        <RiQuestionLine size={14} />
        질문
      </button>

      {/* 색상 필터 */}
      <div className="flex items-center gap-1" role="group" aria-label="색상 필터">
        {POST_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorFilterChange(colorFilter === c ? null : c)}
            title={`${POST_COLOR_STYLES[c].label}만 보기`}
            aria-label={`${POST_COLOR_STYLES[c].label} 필터`}
            className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
              colorFilter === c
                ? "border-graphite scale-125"
                : colorFilter
                  ? "border-silver-mist opacity-40"
                  : "border-silver-mist"
            }`}
            style={{ backgroundColor: POST_COLOR_STYLES[c].dot }}
          />
        ))}
      </div>

      {/* 세션 타이머 (admin) */}
      {onOpenTimer && (
        <button
          onClick={onOpenTimer}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-chalk-card border border-silver-mist rounded-full hover:border-graphite transition-colors cursor-pointer"
          title="모든 참여자에게 표시되는 타이머 시작"
        >
          <RiTimerFlashLine size={14} />
          타이머
        </button>
      )}

      <button
        onClick={onOpenParticipants}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink bg-chalk-card border border-silver-mist rounded-full hover:border-graphite transition-colors cursor-pointer"
      >
        <RiTeamLine size={14} />
        {participantCount}
      </button>
    </div>
  );
}
