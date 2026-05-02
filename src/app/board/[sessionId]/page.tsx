"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import PostGrid from "@/components/board/PostGrid";
import PostInput from "@/components/board/PostInput";
import ChatPanel from "@/components/chat/ChatPanel";
import { getSession, onParticipants, onPosts, Session } from "@/lib/firestore";
import { RiChat3Line, RiStickyNoteLine } from "react-icons/ri";

interface ParticipantInfo {
  participantId: string;
  name: string;
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: authSession } = useSession();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"board" | "chat">("board");

  useEffect(() => {
    const stored = sessionStorage.getItem(`padolet_${sessionId}`);
    if (!stored) {
      router.push("/");
      return;
    }
    setParticipant(JSON.parse(stored));

    getSession(sessionId).then((s) => {
      if (!s) {
        router.push("/");
        return;
      }
      setSession(s);
      setLoading(false);
    });
  }, [sessionId, router]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onParticipants(sessionId, (p) => setParticipantCount(p.length));
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onPosts(sessionId, (p) => setPostCount(p.length));
    return () => unsub();
  }, [sessionId]);

  if (loading || !participant) {
    return (
      <div className="flex-1 flex items-center justify-center bg-eggshell text-gravel">
        로딩 중...
      </div>
    );
  }

  const adminId = (authSession?.user as Record<string, unknown>)?.id as string | undefined;
  const isAdmin = !!adminId && session?.createdBy === adminId;

  return (
    <div className="flex flex-col h-screen bg-eggshell relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: "url('/board-bg.png')", opacity: 0.1 }}
      />
      <div className="relative z-10 flex flex-col h-full">
      <Nav
        sessionTitle={session?.title}
        sessionCode={session?.code}
        sessionId={sessionId}
        participantCount={participantCount}
        isAdmin={isAdmin}
      />

      {/* 데스크탑: 좌 3/4 보드 + 우 1/4 채팅 */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto" style={{ width: "75%" }}>
          <PostInput
            sessionId={sessionId}
            authorId={participant.participantId}
            authorName={participant.name}
            currentPostCount={postCount}
          />
          <PostGrid sessionId={sessionId} isAdmin={isAdmin} />
        </div>
        <div style={{ width: "25%" }}>
          <ChatPanel
            sessionId={sessionId}
            authorId={participant.participantId}
            authorName={participant.name}
          />
        </div>
      </div>

      {/* 모바일: 탭 전환 */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {mobileTab === "board" ? (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <PostInput
              sessionId={sessionId}
              authorId={participant.participantId}
              authorName={participant.name}
              currentPostCount={postCount}
            />
            <PostGrid sessionId={sessionId} isAdmin={isAdmin} />
          </div>
        ) : (
          <div className="flex-1">
            <ChatPanel
              sessionId={sessionId}
              authorId={participant.participantId}
              authorName={participant.name}
            />
          </div>
        )}

        {/* 모바일 하단 탭 바 */}
        <div className="flex border-t border-chalk bg-white">
          <button
            onClick={() => setMobileTab("board")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer ${
              mobileTab === "board" ? "text-obsidian font-medium" : "text-gravel"
            }`}
          >
            <RiStickyNoteLine size={16} />
            보드
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer ${
              mobileTab === "chat" ? "text-obsidian font-medium" : "text-gravel"
            }`}
          >
            <RiChat3Line size={16} />
            대화
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
