"use client";

import { useEffect, useState } from "react";
import { Poll, onPolls, getQuizLeaderboard, LeaderboardEntry } from "@/lib/firestore";
import PollCard from "./PollCard";
import CreatePollModal from "./CreatePollModal";
import Modal from "@/components/ui/Modal";
import { RiAddLine, RiBarChart2Line, RiTrophyLine, RiRefreshLine } from "react-icons/ri";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  voterId: string;
  voterName: string;
  isAdmin: boolean;
}

export default function PollPanel({
  open,
  onClose,
  sessionId,
  voterId,
  voterName,
  isAdmin,
}: Props) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [leaderboardQuizCount, setLeaderboardQuizCount] = useState(0);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    if (!open) return;
    const unsub = onPolls(sessionId, setPolls);
    return () => unsub();
  }, [open, sessionId]);

  const activePolls = polls.filter((p) => p.active);
  const endedPolls = polls.filter((p) => !p.active);
  // 리더보드 대상: 정답이 설정된 비익명 퀴즈
  const hasQuiz = polls.some(
    (p) => p.correctIndex !== null && p.correctIndex !== undefined && !p.anonymous
  );

  async function loadLeaderboard() {
    setLoadingLeaderboard(true);
    try {
      const { entries, quizCount } = await getQuizLeaderboard(sessionId);
      setLeaderboard(entries);
      setLeaderboardQuizCount(quizCount);
    } catch {
      setLeaderboard([]);
      setLeaderboardQuizCount(0);
    }
    setLoadingLeaderboard(false);
  }

  function toggleLeaderboard() {
    const next = !showLeaderboard;
    setShowLeaderboard(next);
    if (next && leaderboard === null) loadLeaderboard();
  }

  return (
    <>
      <Modal open={open} onClose={onClose} className="max-w-2xl max-h-[85vh] flex flex-col" showClose={false}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-silver-mist">
          <h2
            className="font-display text-2xl text-graphite flex items-center gap-2"
            style={{ fontWeight: 700, letterSpacing: "-0.6px" }}
          >
            <RiBarChart2Line size={20} />
            투표 / 퀴즈
          </h2>
          <div className="flex items-center gap-2">
            {hasQuiz && (
              <button
                onClick={toggleLeaderboard}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold border cursor-pointer transition-colors ${
                  showLeaderboard
                    ? "bg-graphite text-chalk-card border-graphite"
                    : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
                }`}
              >
                <RiTrophyLine size={14} />
                리더보드
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-graphite text-chalk-card hover:bg-graphite-dark cursor-pointer"
              >
                <RiAddLine size={14} />
                새 투표
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-text hover:text-graphite cursor-pointer"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 퀴즈 리더보드 */}
          {showLeaderboard && (
            <div className="border border-silver-mist rounded-xl bg-chalk-card shadow-[--shadow-card] overflow-hidden">
              <div className="px-5 py-3 border-b border-silver-mist flex items-center justify-between">
                <h3 className="text-sm font-semibold text-graphite flex items-center gap-1.5">
                  <RiTrophyLine size={14} />
                  퀴즈 리더보드
                  {leaderboardQuizCount > 0 && (
                    <span className="text-xs text-slate-text font-normal">
                      퀴즈 {leaderboardQuizCount}개 기준
                    </span>
                  )}
                </h3>
                <button
                  onClick={loadLeaderboard}
                  disabled={loadingLeaderboard}
                  className="text-slate-text hover:text-graphite cursor-pointer disabled:opacity-50"
                  title="새로고침"
                  aria-label="리더보드 새로고침"
                >
                  <RiRefreshLine size={14} className={loadingLeaderboard ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="px-5 py-3">
                {loadingLeaderboard && leaderboard === null ? (
                  <p className="text-xs text-ash-text text-center py-4">집계 중...</p>
                ) : !leaderboard || leaderboard.length === 0 ? (
                  <p className="text-xs text-ash-text text-center py-4">
                    아직 집계할 퀴즈 응답이 없습니다.
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {leaderboard.slice(0, 10).map((entry, idx) => (
                      <li
                        key={entry.voterId}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 text-center font-bold tabular-nums ${
                              idx === 0 ? "text-ochre" : "text-slate-text"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-ink truncate">{entry.name}</span>
                        </span>
                        <span className="text-xs text-slate-text tabular-nums shrink-0">
                          정답 {entry.correct} / 응답 {entry.answered}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-[10px] text-ash-text mt-3">
                  익명 투표로 진행된 퀴즈는 집계에 포함되지 않습니다.
                </p>
              </div>
            </div>
          )}

          {polls.length === 0 && (
            <p className="text-sm text-ash-text text-center py-12">
              {isAdmin
                ? '아직 생성된 투표가 없습니다. "새 투표" 버튼으로 시작하세요.'
                : "진행 중인 투표가 없습니다."}
            </p>
          )}
          {activePolls.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-ash-text font-semibold mb-2">
                진행 중 ({activePolls.length})
              </h3>
              <div className="space-y-3">
                {activePolls.map((p) => (
                  <PollCard
                    key={p.id}
                    sessionId={sessionId}
                    poll={p}
                    voterId={voterId}
                    voterName={voterName}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}
          {endedPolls.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-ash-text font-semibold mb-2 mt-4">
                종료 ({endedPolls.length})
              </h3>
              <div className="space-y-3">
                {endedPolls.map((p) => (
                  <PollCard
                    key={p.id}
                    sessionId={sessionId}
                    poll={p}
                    voterId={voterId}
                    voterName={voterName}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <CreatePollModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        sessionId={sessionId}
        createdBy={voterId}
      />
    </>
  );
}
