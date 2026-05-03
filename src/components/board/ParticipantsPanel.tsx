"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Participant,
  Post,
  Message,
  onParticipants,
  onPosts,
  onMessages,
  blockUserName,
  unblockUserName,
} from "@/lib/firestore";
import Modal from "@/components/ui/Modal";
import { RiUserForbidLine, RiUserUnfollowLine, RiTeamLine } from "react-icons/ri";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  isAdmin: boolean;
  blockedNames: string[];
}

export default function ParticipantsPanel({
  open,
  onClose,
  sessionId,
  isAdmin,
  blockedNames,
}: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!open) return;
    const u1 = onParticipants(sessionId, setParticipants);
    const u2 = onPosts(sessionId, setPosts);
    const u3 = onMessages(sessionId, setMessages);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [open, sessionId]);

  // 작성자별 활동량 집계
  const stats = useMemo(() => {
    const map = new Map<string, { postCount: number; msgCount: number }>();
    posts.forEach((p) => {
      const cur = map.get(p.authorName) || { postCount: 0, msgCount: 0 };
      cur.postCount += 1;
      map.set(p.authorName, cur);
    });
    messages.forEach((m) => {
      const cur = map.get(m.authorName) || { postCount: 0, msgCount: 0 };
      cur.msgCount += 1;
      map.set(m.authorName, cur);
    });
    return map;
  }, [posts, messages]);

  const anonymousCount = participants.filter((p) => p.isAnonymous).length;
  const namedCount = participants.length - anonymousCount;

  async function handleBlock(name: string) {
    if (!confirm(`"${name}" 사용자를 차단하시겠습니까?`)) return;
    await blockUserName(sessionId, name);
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-md max-h-[85vh] flex flex-col" showClose={false}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-silver-mist">
        <h2
          className="font-display text-2xl text-graphite flex items-center gap-2"
          style={{ fontWeight: 700, letterSpacing: "-0.6px" }}
        >
          <RiTeamLine size={20} />
          참여자 ({participants.length})
        </h2>
        <button
          onClick={onClose}
          className="text-slate-text hover:text-graphite cursor-pointer"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      <div className="px-6 py-3 border-b border-silver-mist text-xs text-slate-text flex gap-3">
        <span>실명 {namedCount}</span>
        <span>·</span>
        <span>익명 {anonymousCount}</span>
        <span>·</span>
        <span>포스트잇 {posts.length}</span>
        <span>·</span>
        <span>대화 {messages.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {participants.length === 0 && (
          <p className="text-sm text-ash-text text-center py-8">아직 참여자가 없습니다.</p>
        )}
        {participants.map((p) => {
          const s = stats.get(p.name) || { postCount: 0, msgCount: 0 };
          const isBlocked = blockedNames.includes(p.name);
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                isBlocked ? "border-terracotta/30 bg-buttercup/40" : "border-transparent hover:border-silver-mist"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">
                  {p.name}
                  {p.isAnonymous && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider bg-vellum text-slate-text px-1.5 py-0.5 rounded-full">
                      익명
                    </span>
                  )}
                  {isBlocked && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider bg-terracotta text-chalk-card px-1.5 py-0.5 rounded-full">
                      차단
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-ash-text mt-0.5">
                  포스트잇 {s.postCount} · 대화 {s.msgCount} ·{" "}
                  {p.joinedAt?.toDate
                    ? p.joinedAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                    : "-"}{" "}
                  입장
                </p>
              </div>
              {isAdmin &&
                (isBlocked ? (
                  <button
                    onClick={() => unblockUserName(sessionId, p.name)}
                    className="text-xs text-slate-text hover:text-graphite cursor-pointer flex items-center gap-1"
                    title="차단 해제"
                  >
                    <RiUserUnfollowLine size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleBlock(p.name)}
                    className="text-xs text-slate-text hover:text-terracotta cursor-pointer flex items-center gap-1"
                    title="채팅 차단"
                  >
                    <RiUserForbidLine size={14} />
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
