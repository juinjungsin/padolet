"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth, waitForAuthUser } from "@/lib/firebase";
import Nav from "@/components/layout/Nav";
import PostGrid from "@/components/board/PostGrid";
import MaterialsList from "@/components/board/MaterialsList";
import type { PostCardContext } from "@/components/board/PostCard";
import type { PostFilter, PostSortMode } from "@/lib/post-kind";
import PostInput from "@/components/board/PostInput";
import ChatPanel from "@/components/chat/ChatPanel";
import AnnouncementModal from "@/components/board/AnnouncementModal";
import BoardToolbar from "@/components/board/BoardToolbar";
import ParticipantsPanel from "@/components/board/ParticipantsPanel";
import PollPanel from "@/components/poll/PollPanel";
import ModerationPanel from "@/components/admin/ModerationPanel";
import ConnectionBanner from "@/components/ui/ConnectionBanner";
import WaveDecor from "@/components/ui/WaveDecor";
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
  touchSessionLastUsed,
  HEARTBEAT_SECONDS,
  Post,
  PostColor,
  PostKind,
  Session,
} from "@/lib/firestore";
import { RiChat3Line, RiStickyNoteLine, RiLockFill, RiLayoutMasonryLine, RiBookOpenLine } from "react-icons/ri";

type BoardView = "board" | "materials";

const VIEW_TABS: { key: BoardView; label: string; icon: React.ReactNode }[] = [
  { key: "board", label: "보드", icon: <RiLayoutMasonryLine size={16} aria-hidden /> },
  { key: "materials", label: "자료", icon: <RiBookOpenLine size={16} aria-hidden /> },
];

interface ParticipantInfo {
  participantId: string;
  name: string;
}

type MobileTab = "board" | "chat";

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("board");
  const [showModeration, setShowModeration] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<PostSortMode>("default");
  const [kindFilter, setKindFilter] = useState<PostKind | null>(null);
  const [instructorOnly, setInstructorOnly] = useState(false);
  const [colorFilter, setColorFilter] = useState<PostColor | null>(null);
  const [view, setView] = useState<BoardView>("board");
  // 입력 중에도 타이핑이 끊기지 않도록 검색 결과 계산은 뒤로 미룬다 (서버 요청은 없음 — 받은 게시물에서 검색)
  const deferredQuery = useDeferredValue(searchQuery);
  // 좁은 화면 안 읽은 대화 배지 — 전체 메시지 수와 마지막 확인 수의 차
  const [chatTotal, setChatTotal] = useState<number | null>(null);
  const [chatSeen, setChatSeen] = useState<number | null>(null);
  // onMessages 콜백에서 현재 탭을 참조하기 위한 ref (stale closure 방지)
  const mobileTabRef = useRef<MobileTab>("board");
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
          setNotFound(true);
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
        setNotFound(true);
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
        // 관리자 목록 "최근 사용순" 정렬용 — 실패해도 입장에는 영향 없음
        touchSessionLastUsed(sessionId).catch(() => {});
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

  // 게시물 구독은 여기서 한 번만 — 보드·자료 보기와 입력창(배치 순서)이 함께 쓴다
  useEffect(() => {
    if (!sessionId) return;
    const unsub = onPosts(sessionId, setPosts);
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSession(sessionId, (s) => {
      if (s) setSession(s);
    });
    return () => unsub();
  }, [sessionId]);

  // 안 읽은 대화 수 추적 (좁은 화면 배지용)
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
  function switchMobileTab(tab: MobileTab) {
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

  if (notFound) {
    return (
      <div className="flex-1 relative flex flex-col items-center justify-center gap-4 px-4 py-16 text-center overflow-hidden">
        <h1 className="text-2xl font-bold text-graphite">세션을 찾을 수 없습니다</h1>
        <p className="text-slate-text">입장 코드가 바뀌었거나 세션이 삭제되었을 수 있습니다.</p>
        <Link
          href="/"
          className="relative z-10 inline-flex items-center justify-center h-11 px-5 rounded-full bg-graphite text-chalk-card font-semibold"
        >
          입장 코드 다시 입력하기
        </Link>
        <WaveDecor />
      </div>
    );
  }

  if (loading || !participant) {
    return (
      <div role="status" className="flex-1 flex items-center justify-center text-slate-text">
        보드를 불러오는 중...
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

  const postFilter: PostFilter = {
    query: deferredQuery,
    kind: kindFilter,
    instructorOnly,
    color: colorFilter,
    sessionOwnerId: session?.createdBy,
  };
  const cardContext: PostCardContext = {
    sessionId,
    isAdmin,
    sessionOwnerId: session?.createdBy,
    currentUserId: participant.participantId,
    currentUserName: participant.name,
    bannedWords,
    spotlightPostId: session?.spotlightPostId,
    locked: lockedForMe,
  };

  async function handleToggleLock() {
    if (!isAdmin) return;
    const next = !boardLocked;
    if (
      next &&
      !confirm(
        "보드를 잠금 상태로 변경하시겠습니까?\n교육생은 열람만 가능하며 포스트잇 작성/대화/리액션이 차단됩니다."
      )
    )
      return;
    try {
      await setBoardLocked(sessionId, next);
    } catch {
      alert("잠금 상태 변경에 실패했습니다.");
    }
  }

  const tabButton = (tab: MobileTab) =>
    `touch-target relative flex-1 flex items-center justify-center gap-1.5 py-3 text-sm cursor-pointer border-t-2 ${
      mobileTab === tab ? "text-graphite font-semibold border-graphite" : "text-slate-text border-transparent"
    }`;

  return (
    <div className="flex flex-col h-dvh">
      <Nav
        wide
        sessionTitle={session?.title}
        sessionCode={session?.code}
        sessionId={sessionId}
        participantCount={participantCount}
        isAdmin={isAdmin}
        onOpenModeration={isAdmin ? () => setShowModeration(true) : undefined}
        onOpenPolls={() => setShowPolls(true)}
        onOpenTimer={isAdmin ? () => setShowTimerModal(true) : undefined}
        isLocked={boardLocked}
        onToggleLock={isAdmin ? handleToggleLock : undefined}
      />

      <ConnectionBanner />

      {/* 보드 잠금 배너 */}
      {boardLocked && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 px-4 py-2 border-b border-silver-mist bg-buttercup text-ochre text-sm"
        >
          <RiLockFill size={14} aria-hidden />
          <span className="font-semibold">보드가 잠금 상태입니다.</span>
          <span className="hidden sm:inline">현재 내용은 열람만 가능합니다.</span>
          {isAdmin && (
            <button
              onClick={handleToggleLock}
              className="touch-target ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-ochre/40 hover:border-ochre cursor-pointer transition-colors"
            >
              잠금 해제
            </button>
          )}
        </div>
      )}

      {/* 세션 동기화 타이머 배너 (모든 참여자 공통) */}
      <SessionTimerBanner timer={session?.timer} isAdmin={isAdmin} sessionId={sessionId} />

      {/* 1024px 이상: 보드 + 대화 나란히 / 그보다 좁으면 하단 탭으로 전환 (한 번만 렌더) */}
      <div className="flex-1 min-h-0 flex">
        <main
          id="board-panel"
          aria-label="보드"
          className={`${mobileTab === "board" ? "flex" : "hidden"} lg:flex flex-1 min-w-0 flex-col overflow-y-auto`}
        >
          {/* 보기 전환 — 같은 게시물을 보드(카드 벽) 또는 자료 목록으로 */}
          <div role="tablist" aria-label="게시물 보기" className="flex gap-1 px-4 pt-3 bg-parchment">
            {VIEW_TABS.map((t) => (
              <button
                key={t.key}
                id={`view-tab-${t.key}`}
                role="tab"
                aria-selected={view === t.key}
                aria-controls="view-panel"
                onClick={() => setView(t.key)}
                className={`touch-target inline-flex items-center gap-1.5 h-10 px-4 rounded-t-lg text-sm font-semibold border-b-2 cursor-pointer ${
                  view === t.key
                    ? "text-graphite border-graphite bg-chalk-card"
                    : "text-slate-text border-transparent hover:text-graphite"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <PostInput
            sessionId={sessionId}
            authorId={participant.participantId}
            authorName={participant.name}
            currentPostCount={posts?.length ?? 0}
            isAdmin={isAdmin}
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
            kindFilter={kindFilter}
            onKindFilterChange={setKindFilter}
            instructorOnly={instructorOnly}
            onInstructorOnlyChange={setInstructorOnly}
            colorFilter={colorFilter}
            onColorFilterChange={setColorFilter}
          />
          <div id="view-panel" role="tabpanel" aria-labelledby={`view-tab-${view}`}>
            {view === "board" ? (
              <PostGrid posts={posts} filter={postFilter} sortMode={sortMode} ctx={cardContext} />
            ) : (
              <MaterialsList posts={posts} filter={postFilter} sortMode={sortMode} />
            )}
          </div>
        </main>
        <aside
          id="chat-panel"
          aria-label="대화"
          className={`${mobileTab === "chat" ? "flex" : "hidden"} lg:flex w-full lg:w-[360px] xl:w-[400px] shrink-0 flex-col min-h-0`}
        >
          <ChatPanel
            sessionId={sessionId}
            authorId={participant.participantId}
            authorName={participant.name}
            isAdmin={isAdmin}
            bannedWords={bannedWords}
            blockedNames={blockedNames}
            locked={lockedForMe}
          />
        </aside>
      </div>

      {/* 좁은 화면 하단 탭 바 */}
      <div role="tablist" aria-label="보기 전환" className="lg:hidden flex border-t border-silver-mist bg-chalk-card pb-safe">
        <button
          role="tab"
          aria-selected={mobileTab === "board"}
          aria-controls="board-panel"
          onClick={() => switchMobileTab("board")}
          className={tabButton("board")}
        >
          <RiStickyNoteLine size={18} aria-hidden />
          보드
        </button>
        <button
          role="tab"
          aria-selected={mobileTab === "chat"}
          aria-controls="chat-panel"
          onClick={() => switchMobileTab("chat")}
          className={tabButton("chat")}
        >
          <RiChat3Line size={18} aria-hidden />
          대화
          {unreadChat > 0 && mobileTab === "board" && (
            <span
              className="min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-terracotta text-chalk-card text-[11px] font-bold leading-none"
              aria-label={`안 읽은 대화 ${unreadChat}건`}
            >
              {unreadChat > 99 ? "99+" : unreadChat}
            </span>
          )}
        </button>
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
