"use client";

import { POST_COLORS, PostColor } from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { METRICS } from "@/lib/metrics";
import { PostSortMode } from "./PostGrid";
import { RiSearchLine, RiCloseLine, RiTeamLine, RiQuestionLine } from "react-icons/ri";

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
}

const pill =
  "touch-target inline-flex items-center justify-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-full border transition-colors cursor-pointer";

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
}: Props) {
  return (
    <div className="px-4 py-3 border-b border-silver-mist bg-chalk-card flex items-center gap-2 flex-wrap">
      <div className="basis-full sm:basis-auto flex-1 min-w-[200px] relative">
        <RiSearchLine
          size={16}
          aria-hidden
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ash-text pointer-events-none"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="본문·작성자·파일명 검색"
          aria-label="포스트잇 검색"
          className="w-full h-10 pl-9 pr-10 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="touch-target absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-text hover:text-graphite cursor-pointer"
            aria-label="검색어 지우기"
          >
            <RiCloseLine size={16} aria-hidden />
          </button>
        )}
      </div>

      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as PostSortMode)}
        aria-label="포스트잇 정렬"
        className="touch-target h-9 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite cursor-pointer"
      >
        <option value="default">등록순</option>
        <option value="latest">최신순</option>
        <option value="reactions">공감순</option>
      </select>

      <button
        onClick={() => onQuestionsOnlyChange(!questionsOnly)}
        aria-pressed={questionsOnly}
        className={`${pill} ${
          questionsOnly
            ? "bg-graphite text-chalk-card border-graphite"
            : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
        }`}
        title="질문으로 등록된 포스트잇만 표시"
      >
        <RiQuestionLine size={16} aria-hidden />
        질문만
      </button>

      <div className="flex items-center" role="group" aria-label="색상 필터">
        {POST_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorFilterChange(colorFilter === c ? null : c)}
            aria-pressed={colorFilter === c}
            title={`${POST_COLOR_STYLES[c].label}만 보기`}
            aria-label={`${POST_COLOR_STYLES[c].label} 포스트잇만 보기`}
            className="touch-target inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
          >
            <span
              aria-hidden
              className={`block w-4 h-4 rounded-full border-2 transition-transform ${
                colorFilter === c
                  ? "border-graphite scale-125"
                  : colorFilter
                    ? "border-transparent opacity-40"
                    : "border-transparent"
              }`}
              style={{ backgroundColor: POST_COLOR_STYLES[c].dot }}
            />
          </button>
        ))}
      </div>

      <button
        onClick={onOpenParticipants}
        title={`참여자 보기 — ${METRICS.cumulative.label} ${participantCount}명`}
        aria-label={`참여자 보기, ${METRICS.cumulative.label} ${participantCount}명`}
        className={`${pill} ml-auto bg-chalk-card text-ink border-silver-mist hover:border-graphite`}
      >
        <RiTeamLine size={16} aria-hidden />
        {participantCount}
      </button>
    </div>
  );
}
