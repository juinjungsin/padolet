"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Poll,
  PollVote,
  onPollVotes,
  castVote,
  endPoll,
  deletePoll,
} from "@/lib/firestore";
import {
  RiBarChart2Line,
  RiCheckLine,
  RiCloseLine,
  RiTrophyLine,
} from "react-icons/ri";

interface Props {
  sessionId: string;
  poll: Poll;
  voterId: string;
  voterName: string;
  isAdmin: boolean;
}

export default function PollCard({ sessionId, poll, voterId, voterName, isAdmin }: Props) {
  const [votes, setVotes] = useState<PollVote[]>([]);

  useEffect(() => {
    if (!poll.id) return;
    const unsub = onPollVotes(sessionId, poll.id, setVotes);
    return () => unsub();
  }, [sessionId, poll.id]);

  const myVote = votes.find((v) => v.voterId === voterId);
  const totalVotes = votes.length;
  const isQuiz = poll.correctIndex !== null && poll.correctIndex !== undefined;
  const showResults = !poll.active || !!myVote || isAdmin;

  const counts = useMemo(() => {
    const arr = new Array(poll.options.length).fill(0);
    votes.forEach((v) => {
      if (v.optionIndex >= 0 && v.optionIndex < arr.length) arr[v.optionIndex] += 1;
    });
    return arr;
  }, [votes, poll.options.length]);

  async function handleVote(idx: number) {
    if (!poll.id || !poll.active || myVote) return;
    await castVote(sessionId, poll.id, voterId, voterName, idx);
  }

  return (
    <div className="border border-silver-mist rounded-xl bg-chalk-card shadow-[--shadow-card] overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-silver-mist flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-linen text-ink px-2 py-0.5 rounded-full font-semibold">
              {isQuiz ? <RiTrophyLine size={10} /> : <RiBarChart2Line size={10} />}
              {isQuiz ? "퀴즈" : "투표"}
            </span>
            {!poll.active && (
              <span className="text-[10px] uppercase tracking-wider bg-vellum text-slate-text px-2 py-0.5 rounded-full font-semibold">
                종료
              </span>
            )}
            {poll.anonymous && (
              <span className="text-[10px] text-ash-text">익명</span>
            )}
          </div>
          <p className="text-base text-ink font-semibold leading-snug">{poll.question}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            {poll.active && (
              <button
                onClick={() => poll.id && endPoll(sessionId, poll.id)}
                title="투표 종료"
                className="text-xs text-slate-text hover:text-graphite cursor-pointer"
              >
                종료
              </button>
            )}
            <button
              onClick={() => {
                if (confirm("이 투표를 삭제하시겠습니까?")) {
                  poll.id && deletePoll(sessionId, poll.id);
                }
              }}
              title="삭제"
              className="text-slate-text hover:text-terracotta cursor-pointer"
            >
              <RiCloseLine size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-2">
        {poll.options.map((opt, idx) => {
          const count = counts[idx];
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMine = myVote?.optionIndex === idx;
          const isCorrect = isQuiz && poll.correctIndex === idx;
          const canClick = poll.active && !myVote;

          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={!canClick}
              className={`group relative w-full text-left p-3 rounded-lg border transition-colors ${
                canClick
                  ? "border-silver-mist hover:border-graphite cursor-pointer"
                  : "border-silver-mist cursor-default"
              } ${isMine ? "border-graphite bg-vellum" : ""}`}
            >
              {showResults && (
                <div
                  className={`absolute inset-0 rounded-lg ${
                    isCorrect ? "bg-sage/20" : "bg-vellum"
                  }`}
                  style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-ink">
                  {isMine && <RiCheckLine size={14} className="text-graphite" />}
                  {isCorrect && showResults && <RiTrophyLine size={14} className="text-sage" />}
                  {opt}
                </span>
                {showResults && (
                  <span className="text-xs text-slate-text font-semibold tabular-nums">
                    {pct}% · {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-4 text-xs text-ash-text">
        총 {totalVotes}표
        {myVote && (
          <span className="ml-2 text-graphite">· 내 선택: {poll.options[myVote.optionIndex]}</span>
        )}
        {!poll.active && isQuiz && poll.correctIndex !== undefined && poll.correctIndex !== null && (
          <span className="ml-2 text-sage font-semibold">
            정답: {poll.options[poll.correctIndex]}
          </span>
        )}
      </div>
    </div>
  );
}
