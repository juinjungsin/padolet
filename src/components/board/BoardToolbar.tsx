"use client";

import { RiSearchLine, RiCloseLine, RiTeamLine } from "react-icons/ri";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenParticipants: () => void;
  participantCount: number;
}

export default function BoardToolbar({
  searchQuery,
  onSearchChange,
  onOpenParticipants,
  participantCount,
}: Props) {
  return (
    <div className="px-4 py-2 border-b border-silver-mist flex items-center gap-2">
      <div className="flex-1 relative">
        <RiSearchLine
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ash-text pointer-events-none"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="포스트잇 / 작성자 검색"
          className="w-full pl-8 pr-8 py-2 text-sm text-ink bg-vellum border border-silver-mist rounded-full outline-none focus:border-graphite"
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
