"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth, waitForAuthUser } from "@/lib/firebase";
import Nav from "@/components/layout/Nav";
import PostGrid, { PostSortMode } from "@/components/board/PostGrid";
import PostInput from "@/components/board/PostInput";
import ChatPanel from "@/components/chat/ChatPanel";
import AnnouncementModal from "@/components/board/AnnouncementModal";
import BoardToolbar from "@/components/board/BoardToolbar";
import ParticipantsPanel from "@/components/board/ParticipantsPanel";
import PollPanel from "@/components/poll/PollPanel";
import ModerationPanel from "@/components/admin/ModerationPanel";
import { SessionTimerBanner, SessionTimerModal } from "@/components/board/SessionTimer";
import {
  getSession,
  onMessages,
  onParticipants,
  onPosts,
  onSession,
  touchParticipant,
  setBoardLocked,
  addParticipant,
  isSuperAdmin,
  HEARTBEAT_SECONDS,
  PostColor,
  Session,
} from "@/lib/firestore";
import { RiChat3Line, RiStickyNoteLine, RiLockFill } from "react-icons/ri";

interface ParticipantInfo {
  participantId: string;
  name: string;
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"board" | "chat">("board");
  const [showModeration, setShowModeration] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<PostSortMode>("default");
  const [questionsOnly, setQuestionsOnly] = useState(false);
  const [colorFilter, setColorFilter] = useState<PostColor | null>(null);
  // 모바일 안 읽은 대화 배지 — 전체 메시지 수와 마지막 확인 수의 차
  const [chatTotal, setChatTotal] = useState<number | null>(null);
  const [chatSeen, setChatSeen] = useState<number | null>(null);
  // onMessages 콜백에서 현재 탭을 참조하기 위한 ref (stale closure 방지)
  const mobileTabRef = useRef<"board" | "chat">("board");
  // 세션 소유자 판별은 Firebase Auth uid 기준 (createdBy에 Firebase uid가 저장됨)
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), (u) => setFirebaseUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (participant) return; // 이미 입장 처리 완료

    const stored = sessionStorage.getItem(`padolet_${sessionId}`);
    if (stored) {
      setParticipant(JSON.parse(stored));
      getSession(sessionId).then((s) => {
        if (!s) {
          router.push("/");
          return;
        }
        setSession(s);
        setLoading(false);
      });
      return;
    }

    // 입장 기록 없이 보드 URL로 직접 접근한 경우 —
    // 관리자(소유자/super_admin)는 자동 입장, 일반 사용자는 코드가 채워진 join 화면으로.
    if (authStatus === "loading") return; // NextAuth 세션 복원 대기 후 재실행

    let cancelled = false;
    (async () => {
      const s = await getSession(sessionId);
      if (cancelled) return;
      if (!s) {
        router.push("/");
        return;
      }

      const email = authSession?.user?.email;
      const legacyId = (authSession?.user as Record<string, unknown> | undefined)?.id as
        | string
        | undefined;
      // FirebaseAuthSync의 이중 로그인이 끝날 때까지 대기 (미로그인 시 null)
      const fbUser = authStatus === "authenticated" ? await waitForAuthUser() : null;
      if (cancelled) return;

      const isOwnerOrSuper =
        (!!fbUser && s.createdBy === fbUser.uid) ||
        (!!legacyId && s.createdBy === legacyId) || // 구 보드(NextAuth id) 호환
        isSuperAdmin(email);

      if (isOwnerOrSuper && fbUser) {
        const name = authSession?.user?.name || "관리자";
        try {
          await addParticipant(sessionId, fbUser.uid, {
            name,
            isAnonymous: false,
            isOnline: true,
          });
        } catch {
          // 참여자 등록이 실패해도 보드 열람은 진행
        }
        if (cancelled) return;
        const info = { participantId: fbUser.uid, name };
        sessionStorage.setItem(`padolet_${sessionId}`, JSON.stringify(info));
        setParticipant(info);
        setSession(s);
        setLoading(false);
      } else {
        router.push(`/join?code=${s.code}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router, participant, authStatus, authSession]);

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

  // 안 읽은 대화 수 추적 (모바일 배지용)
  useEffect(() => {
    if (!sessionId) return;
    const unsub = onMessages(sessionId, (msgs) => {
      const visible = msgs.filter((m) => !m.hidden).length;
      setChatTotal(visible);
      // 최초 로드 시 또는 대화 탭을 보는 중에는 모두 읽음 처리
      setChatSeen((prev) =>
        prev === null || mobileTabRef.current === "chat" ? visible : prev
      );
    });
    return () => unsub();
  }, [sessionId]);

  // 탭 전환 핸들러 — 대화 탭 진입 시 읽음 처리
  function switchMobileTab(tab: "board" | "chat") {
    mobileTabRef.current = tab;
    setMobileTab(tab);
    if (tab === "chat" && chatTotal !== null) setChatSeen(chatTotal);
  }

  // presence heartbeat — 주기적으로 lastSeenAt 갱신 (Firestore 쓰기 비용 고려해 보수적 주기)
  useEffect(() => {
    if (!sessionId || !participant) return;
    touchParticipant(sessionId, participant.participantId).catch(() => {});
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        touchParticipant(sessionId, participant.participantId).catch(() => {});
      }
    }, HEARTBEAT_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [sessionId, participant]);

  if (loading || !participant) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent text-slate-text">
        로딩 중...
      </div>
    );
  }

  // 관리자 판별 — 신규 보드(createdBy=Firebase uid), 구 보드(createdBy=NextAuth id), super_admin 모두 지원
  const legacyAdminId = (authSession?.user as Record<string, unknown>)?.id as string | undefined;
  const isAdmin =
    !!session &&
    ((!!firebaseUid && session.createdBy === firebaseUid) ||
      (!!legacyAdminId && session.createdBy === legacyAdminId) ||
      isSuperAdmin(authSession?.user?.email));
  const bannedWords = session?.bannedWords || [];
  const blockedNames = session?.blockedNames || [];
  const unreadChat =
    chatTotal !== null && chatSeen !== null ? Math.max(0, chatTotal - chatSeen) : 0;
  const boardLocked = !!session?.locked;
  // 참여자 기준 잠금 (admin은 잠금 중에도 모든 기능 사용 가능)
  const lockedForMe = boardLocked && !isAdmin;

  async function handleToggleLock() {
    if (!isAdmin) return;
    const next = !boardLocked;
    if (
      next &&
      !confirm(
        "보드를 잠금 상태로 변경하시겠습니까?\n참여자는 열람만 가능하며 포스트잇 작성/대화/리액션이 차단됩니다."
      )
    )
      return;
    try {
      await setBoardLocked(sessionId, next);
    } catch {
      alert("잠금 상태 변경에 실패했습니다.");
    }
  }

  return (
    <div className="flex flex-col h-screen bg-transparent relative">
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
        onOpenPolls={() => setShowPolls(true)}
        isLocked={boardLocked}
        onToggleLock={isAdmin ? handleToggleLock : undefined}
      />

      {/* 보드 잠금 배너 */}
      {boardLocked && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-silver-mist bg-buttercup text-ochre text-sm">
          <RiLockFill size={14} />
          <span className="font-semibold">보드가 잠금 상태입니다.</span>
          <span className="hidden sm:inline">현재 내용은 열람만 가능합니다.</span>
          {isAdmin && (
            <button
              onClick={handleToggleLock}
              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-ochre/40 hover:border-ochre cursor-pointer transition-colors"
            >
              잠금해제
            </button>
          )}
        </div>
      )}

      {/* 세션 동기화 타이머 배너 (모든 참여자 공통) */}
      <SessionTimerBanner timer={session?.timer} isAdmin={isAdmin} sessionId={sessionId} />

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
            locked={lockedForMe}
          />
          <BoardToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenParticipants={() => setShowParticipants(true)}
            participantCount={participantCount}
            sortMode={sortMode}
            onSortChange={setSortMode}
            questionsOnly={questionsOnly}
            onQuestionsOnlyChange={setQuestionsOnly}
            colorFilter={colorFilter}
            onColorFilterChange={setColorFilter}
            onOpenTimer={isAdmin ? () => setShowTimerModal(true) : undefined}
          />
          <PostGrid
            sessionId={sessionId}
            isAdmin={isAdmin}
            currentUserId={participant.participantId}
            currentUserName={participant.name}
            bannedWords={bannedWords}
            searchQuery={searchQuery}
            sortMode={sortMode}
            questionsOnly={questionsOnly}
            colorFilter={colorFilter}
            spotlightPostId={session?.spotlightPostId}
            locked={lockedForMe}
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
            locked={lockedForMe}
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
              locked={lockedForMe}
            />
            <PostGrid
              sessionId={sessionId}
              isAdmin={isAdmin}
              currentUserId={participant.participantId}
              currentUserName={participant.name}
              bannedWords={bannedWords}
              spotlightPostId={session?.spotlightPostId}
              locked={lockedForMe}
            />
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
              locked={lockedForMe}
            />
          </div>
        )}

        {/* 모바일 하단 탭 바 */}
        <div className="flex border-t border-silver-mist bg-chalk-card">
          <button
            onClick={() => switchMobileTab("board")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer ${
              mobileTab === "board" ? "text-graphite font-semibold" : "text-slate-text"
            }`}
          >
            <RiStickyNoteLine size={16} />
            보드
          </button>
          <button
            onClick={() => switchMobileTab("chat")}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer ${
              mobileTab === "chat" ? "text-graphite font-semibold" : "text-slate-text"
            }`}
          >
            <RiChat3Line size={16} />
            대화
            {unreadChat > 0 && mobileTab === "board" && (
              <span className="absolute top-1.5 right-[calc(50%-2.8rem)] min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-terracotta text-chalk-card text-[10px] font-bold leading-none">
                {unreadChat > 99 ? "99+" : unreadChat}
              </span>
            )}
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

      <PollPanel
        open={showPolls}
        onClose={() => setShowPolls(false)}
        sessionId={sessionId}
        voterId={participant.participantId}
        voterName={participant.name}
        isAdmin={isAdmin}
      />

      {showModeration && session && (
        <ModerationPanel
          sessionId={sessionId}
          session={session}
          onClose={() => setShowModeration(false)}
        />
      )}

      {isAdmin && (
        <SessionTimerModal
          open={showTimerModal}
          onClose={() => setShowTimerModal(false)}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
