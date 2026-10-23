"use client";

import { Post } from "@/lib/firestore";
import { Module } from "@/lib/practice";
import {
  countUnanswered,
  filterQuestions,
  isQuestion,
  QUESTION_STATUSES,
  QuestionSortMode,
  QuestionStatusFilter,
  sortQuestions,
  UNANSWERED_HELP,
} from "@/lib/question";
import PostCard, { PostCardContext } from "@/components/board/PostCard";

export interface QuestionViewState {
  status: QuestionStatusFilter;
  mineOnly: boolean;
  moduleId: string | null;
  sort: QuestionSortMode;
}

interface QuestionsListProps {
  posts: Post[] | null;
  query: string;
  state: QuestionViewState;
  onStateChange: (s: QuestionViewState) => void;
  modules: Module[];
  ctx: PostCardContext;
}

const control =
  "touch-target h-9 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite cursor-pointer";

/** 질문 목록 (P1-03) — 미답변·모듈·공감순·최신순 탐색, 내 질문 확인 */
export default function QuestionsList({ posts, query, state, onStateChange, modules, ctx }: QuestionsListProps) {
  if (posts === null) {
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        질문을 불러오는 중...
      </div>
    );
  }

  const set = (patch: Partial<QuestionViewState>) => onStateChange({ ...state, ...patch });
  const all = posts.filter(isQuestion);
  const visible = sortQuestions(
    filterQuestions(posts, {
      status: state.status,
      mineUid: state.mineOnly ? ctx.currentUserId : undefined,
      moduleId: state.moduleId,
      query,
    }),
    state.sort
  );

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="질문 보기 조건">
        <p className="mr-auto text-sm text-slate-text" title={UNANSWERED_HELP}>
          질문 {all.length}개 · <span className="font-semibold text-warn">미답변 {countUnanswered(posts)}개</span>
        </p>
        <select
          value={state.status}
          onChange={(e) => set({ status: e.target.value as QuestionStatusFilter })}
          aria-label="질문 상태 필터"
          className={control}
        >
          <option value="all">모든 상태</option>
          {QUESTION_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.key === "open" ? "미답변(접수)" : s.label}
            </option>
          ))}
        </select>
        {modules.length > 0 && (
          <select
            value={state.moduleId ?? ""}
            onChange={(e) => set({ moduleId: e.target.value || null })}
            aria-label="모듈 필터"
            className={control}
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
          value={state.sort}
          onChange={(e) => set({ sort: e.target.value as QuestionSortMode })}
          aria-label="질문 정렬"
          className={control}
        >
          <option value="latest">최신순</option>
          <option value="meToo">공감순 (저도 궁금해요)</option>
        </select>
        <button
          onClick={() => set({ mineOnly: !state.mineOnly })}
          aria-pressed={state.mineOnly}
          className={`touch-target inline-flex items-center h-9 px-3 rounded-full text-sm font-semibold border cursor-pointer ${
            state.mineOnly ? "bg-graphite text-chalk-card border-graphite" : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
          }`}
        >
          내 질문
        </button>
      </div>

      {visible.length === 0 ? (
        <p role="status" className="py-12 text-center text-slate-text">
          {all.length === 0
            ? "아직 질문이 없습니다. 궁금한 점은 유형을 '질문'으로 골라 올려 주세요."
            : state.status === "open" && !state.mineOnly && !state.moduleId && !query
              ? "미답변 질문이 없습니다."
              : "조건에 맞는 질문이 없습니다."}
        </p>
      ) : (
        <div data-testid="questions-list" className="columns-1 xl:columns-2 gap-4">
          {visible.map((p) => (
            <PostCard key={p.id} post={p} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}
