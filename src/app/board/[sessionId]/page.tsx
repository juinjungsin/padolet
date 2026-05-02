"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import PostGrid from "@/components/board/PostGrid";
import PostInput from "@/components/board/PostInput";
import ChatPanel from "@/components/chat/ChatPanel";
import { getSession, onParticipants, onPosts, Session, Post } from "@/lib/firestore";

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
    <div className="flex flex-col h-screen bg-eggshell">
      <Nav
        sessionTitle={session?.title}
        participantCount={participantCount}
        isAdmin={isAdmin}
      />
      <div className="flex flex-1 overflow-hidden">
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
    </div>
  );
}
