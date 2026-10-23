"use client";

import { useState } from "react";
import { POST_COLORS, PostColor, PostKind } from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { METRICS } from "@/lib/metrics";
import { POST_KINDS, PostSortMode, SORT_RULE_HELP } from "@/lib/post-kind";
import type { Module } from "@/lib/practice";
import { RiSearchLine, RiCloseLine, RiTeamLine, RiUserStarLine, RiFilter3Line } from "react-icons/ri";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenParticipants: () => void;
  participantCount: number;
  sortMode: PostSortMode;
  onSortChange: (m: PostSortMode) => void;
  kindFilter: PostKind | null;
  onKindFilterChange: (k: PostKind | null) => void;
  instructorOnly: boolean;
  onInstructorOnlyChange: (v: boolean) => void;
  colorFilter: PostColor | null;
  onColorFilterChange: (c: PostColor | null) => void;
  /** 실습 모듈이 있을 때만 모듈 필터 표시 */
  modules?: Module[];
  moduleFilter?: string | null;
  onModuleFilterChange?: (id: string | null) => void;
  /** 질문 보기처럼 자체 필터가 있는 화면 — 검색만 표시 */
  searchOnly?: boolean;
}

const pill =
  "touch-target inline-flex items-center justify-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-full border transition-colors cursor-pointer";
const select =
  "touch-target h-9 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite cursor-pointer";

export default function BoardToolbar({
  searchQuery,
  onSearchChange,
  onOpenParticipants,
  participantCount,
  sortMode,
  onSortChange,
  kindFilter,
  onKindFilterChange,
  instructorOnly,
  onInstructorOnlyChange,
  colorFilter,
  onColorFilterChange,
  modules = [],
  moduleFilter = null,
  onModuleFilterChange,
  searchOnly = false,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = [kindFilter, moduleFilter, colorFilter, instructorOnly || null].filter(Boolean).length;
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
          placeholder="제목·본문·작성자·파일명 검색"
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

      {!searchOnly && (
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          aria-controls="board-filters"
          className={`${pill} sm:hidden bg-chalk-card text-ink border-silver-mist`}
        >
          <RiFilter3Line size={16} aria-hidden />
          필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
        </button>
      )}

      {/* 좁은 화면에서는 필터를 접어 두고, sm 이상에서는 래퍼 없이 한 줄에 배치 (sm:contents) */}
      {!searchOnly && (
      <div id="board-filters" className={`${showFilters ? "flex" : "hidden"} sm:contents basis-full flex-wrap items-center gap-2`}>

      <select
        value={kindFilter ?? ""}
        onChange={(e) => onKindFilterChange((e.target.value || null) as PostKind | null)}
        aria-label="게시물 유형 필터"
        className={select}
      >
        <option value="">모든 유형</option>
        {POST_KINDS.map((k) => (
          <option key={k.key} value={k.key}>
            {k.label}
          </option>
        ))}
      </select>

      {modules.length > 0 && onModuleFilterChange && (
        <select
          value={moduleFilter ?? ""}
          onChange={(e) => onModuleFilterChange(e.target.value || null)}
          aria-label="모듈 필터"
          className={select}
        >
          <option value="">모든 모듈</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      )}

      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as PostSortMode)}
        aria-label={`정렬 — ${SORT_RULE_HELP}`}
        title={SORT_RULE_HELP}
        className={select}
      >
        <option value="default">등록순</option>
        <option value="latest">최신순</option>
        <option value="reactions">공감순</option>
      </select>

      <button
        onClick={() => onInstructorOnlyChange(!instructorOnly)}
        aria-pressed={instructorOnly}
        className={`${pill} ${
          instructorOnly
            ? "bg-graphite text-chalk-card border-graphite"
            : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
        }`}
        title="강사가 올린 글만 표시"
      >
        <RiUserStarLine size={16} aria-hidden />
        강사 게시
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

      </div>
      )}

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
