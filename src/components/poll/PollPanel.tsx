"use client";

import { useEffect, useState } from "react";
import { Poll, onPolls } from "@/lib/firestore";
import PollCard from "./PollCard";
import CreatePollModal from "./CreatePollModal";
import Modal from "@/components/ui/Modal";
import { RiAddLine, RiBarChart2Line } from "react-icons/ri";

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

  useEffect(() => {
    if (!open) return;
    const unsub = onPolls(sessionId, setPolls);
    return () => unsub();
  }, [open, sessionId]);

  const activePolls = polls.filter((p) => p.active);
  const endedPolls = polls.filter((p) => !p.active);

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
