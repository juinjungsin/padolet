"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import PostGrid from "@/components/board/PostGrid";
import PostInput from "@/components/board/PostInput";
import ChatPanel from "@/components/chat/ChatPanel";
import AnnouncementModal from "@/components/board/AnnouncementModal";
import BoardToolbar from "@/components/board/BoardToolbar";
import ParticipantsPanel from "@/components/board/ParticipantsPanel";
import ModerationPanel from "@/components/admin/ModerationPanel";
import { getSession, onParticipants, onPosts, onSession, Session } from "@/lib/firestore";
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
  const [showModeration, setShowModeration] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSession(sessionId, (s) => {
      if (s) setSession(s);
    });
    return () => unsub();
  }, [sessionId]);

  if (loading || !participant) {
    return (
      <div className="flex-1 flex items-center justify-center bg-parchment text-slate-text">
        로딩 중...
      </div>
    );
  }

  const adminId = (authSession?.user as Record<string, unknown>)?.id as string | undefined;
  const isAdmin = !!adminId && session?.createdBy === adminId;
  const bannedWords = session?.bannedWords || [];
  const blockedNames = session?.blockedNames || [];

  return (
    <div className="flex flex-col h-screen bg-parchment relative">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
        style={{ backgroundImage: "url('/board-bg.png')", opacity: 0.25 }}
      />
      <div className="relative z-10 flex flex-col h-full">
      <Nav
        sessionTitle={session?.title}
        sessionCode={session?.code}
        sessionId={sessionId}
        participantCount={participantCount}
        isAdmin={isAdmin}
        onOpenModeration={isAdmin ? () => setShowModeration(true) : undefined}
      />

      {/* 데스크탑: 좌 3/4 보드 + 우 1/4 채팅 */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto" style={{ width: "75%" }}>
          <PostInput
            sessionId={sessionId}
            authorId={participant.participantId}
            authorName={participant.name}
            currentPostCount={postCount}
            bannedWords={bannedWords}
            blockedNames={blockedNames}
          />
          <BoardToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenParticipants={() => setShowParticipants(true)}
            participantCount={participantCount}
          />
          <PostGrid
            sessionId={sessionId}
            isAdmin={isAdmin}
            currentUserId={participant.participantId}
            searchQuery={searchQuery}
          />
        </div>
        <div style={{ width: "25%" }}>
          <ChatPanel
            sessionId={sessionId}
            authorId={participant.participantId}
            authorName={participant.name}
            isAdmin={isAdmin}
            bannedWords={bannedWords}
            blockedNames={blockedNames}
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
              bannedWords={bannedWords}
              blockedNames={blockedNames}
            />
            <PostGrid sessionId={sessionId} isAdmin={isAdmin} />
          </div>
        ) : (
          <div className="flex-1">
            <ChatPanel
              sessionId={sessionId}
              authorId={participant.participantId}
              authorName={participant.name}
              isAdmin={isAdmin}
              bannedWords={bannedWords}
              blockedNames={blockedNames}
            />
          </div>
        )}

        {/* 모바일 하단 탭 바 */}
        <div className="flex border-t border-silver-mist bg-chalk-card">
          <button
            onClick={() => setMobileTab("board")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer ${
              mobileTab === "board" ? "text-graphite font-semibold" : "text-slate-text"
            }`}
          >
            <RiStickyNoteLine size={16} />
            보드
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer ${
              mobileTab === "chat" ? "text-graphite font-semibold" : "text-slate-text"
            }`}
          >
            <RiChat3Line size={16} />
            대화
          </button>
        </div>
      </div>
      </div>

      <AnnouncementModal sessionId={sessionId} announcement={session?.announcement} />

      <ParticipantsPanel
        open={showParticipants}
        onClose={() => setShowParticipants(false)}
        sessionId={sessionId}
        isAdmin={isAdmin}
        blockedNames={blockedNames}
      />

      {showModeration && session && (
        <ModerationPanel
          sessionId={sessionId}
          session={session}
          onClose={() => setShowModeration(false)}
        />
      )}
    </div>
  );
}
