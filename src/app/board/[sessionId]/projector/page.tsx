"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  getSession,
  onPosts,
  onMessages,
  onParticipants,
  onSession,
  onPolls,
  onPollVotes,
  reactionTotal,
  Post,
  Message,
  Session,
  Poll,
  PollVote,
} from "@/lib/firestore";
import { isSafeExternalUrl } from "@/lib/url-safe";
import { RiPushpinFill, RiTeamLine, RiTimerFlashLine, RiBarChart2Line, RiFocus3Line } from "react-icons/ri";
import QRCode from "qrcode";

const DOMAIN = "padolet.vercel.app";

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ProjectorPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [polls, setPolls] = useState<Poll[]>([]);
  // pollId를 함께 저장 → 다른 투표의 잔여 데이터가 표시되지 않도록 방지 (초기화 setState 불필요)
  const [pollVotes, setPollVotes] = useState<{ pollId: string; votes: PollVote[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId).then((s) => s && setSession(s));
    const unsubS = onSession(sessionId, (s) => s && setSession(s));
    const unsubP = onPosts(sessionId, setPosts);
    const unsubM = onMessages(sessionId, (msgs) => {
      // 최근 5개만 (가려진 것 제외)
      setRecentMessages(msgs.filter((m) => !m.hidden && m.type === "text").slice(-5));
    });
    const unsubPart = onParticipants(sessionId, (p) => setParticipantCount(p.length));
    const unsubPolls = onPolls(sessionId, setPolls);
    return () => {
      unsubS();
      unsubP();
      unsubM();
      unsubPart();
      unsubPolls();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session?.code) return;
    const joinUrl = `https://${DOMAIN}/join?code=${session.code}`;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 2 }).then(setQrUrl);
  }, [session?.code]);

  // 진행 중인 투표 (가장 최근 것 1개) 실시간 결과 구독
  const activePoll = polls.find((p) => p.active) || null;
  const activePollId = activePoll?.id || null;
  useEffect(() => {
    if (!activePollId) return;
    const unsub = onPollVotes(sessionId, activePollId, (votes) =>
      setPollVotes({ pollId: activePollId, votes })
    );
    return () => unsub();
  }, [sessionId, activePollId]);

  // 세션 타이머 카운트다운 tick
  const timerEndsAtMs = session?.timer?.endsAt?.toMillis?.() ?? null;
  const timerActive = !!session?.timer?.running && timerEndsAtMs !== null;
  useEffect(() => {
    if (!timerActive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerActive]);

  const timerRemainingSec = timerEndsAtMs !== null ? Math.ceil((timerEndsAtMs - now) / 1000) : 0;
  const showTimer =
    timerActive && timerEndsAtMs !== null && now - timerEndsAtMs < 30_000;

  // 스포트라이트 대상 포스트
  const spotlightPost = session?.spotlightPostId
    ? posts.find((p) => p.id === session.spotlightPostId) || null
    : null;

  const pinnedPosts = posts.filter((p) => p.pinned);
  const otherPosts = posts.filter((p) => !p.pinned);

  const currentVotes =
    activePollId && pollVotes?.pollId === activePollId ? pollVotes.votes : [];
  const voteCounts = activePoll
    ? activePoll.options.map(
        (_, idx) => currentVotes.filter((v) => v.optionIndex === idx).length
      )
    : [];
  const totalVotes = currentVotes.length;

  return (
    <div className="min-h-screen bg-transparent text-graphite p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Image src="/icon.png" alt="padolet" width={40} height={40} className="rounded-lg" />
          <div>
            <h1
              className="font-display text-3xl text-graphite"
              style={{ fontWeight: 700, letterSpacing: "-0.8px" }}
            >
              {session?.title || "padolet"}
            </h1>
            <p className="text-sm text-slate-text mt-1">
              padolet 프로젝터 모드 · 입장코드{" "}
              <span className="font-mono font-bold tracking-[0.2em] text-graphite ml-1">
                {session?.code}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {showTimer && (
            <div className="text-right">
              <div
                className={`flex items-center gap-2 justify-end text-4xl font-bold font-mono tabular-nums ${
                  timerRemainingSec <= 0 ? "text-ochre" : "text-graphite"
                }`}
              >
                <RiTimerFlashLine size={28} />
                {timerRemainingSec <= 0 ? "종료" : formatTimer(timerRemainingSec)}
              </div>
              <p className="text-xs text-slate-text uppercase tracking-wider">타이머</p>
            </div>
          )}
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end text-2xl font-bold text-graphite">
              <RiTeamLine size={22} />
              {participantCount}
            </div>
            <p className="text-xs text-slate-text uppercase tracking-wider">참여자</p>
          </div>
          {qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="QR" className="w-32 h-32 rounded-lg border border-silver-mist" />
          )}
        </div>
      </div>

      {/* 진행 중 투표 실시간 결과 */}
      {activePoll && (
        <div className="mb-8 p-6 bg-chalk-card border border-silver-mist rounded-xl shadow-[--shadow-card]">
          <h2
            className="font-display text-2xl text-graphite mb-4 flex items-center gap-2"
            style={{ fontWeight: 700 }}
          >
            <RiBarChart2Line size={22} />
            {activePoll.question}
            <span className="text-sm text-slate-text font-normal ml-2">총 {totalVotes}표</span>
          </h2>
          <div className="space-y-2">
            {activePoll.options.map((opt, idx) => {
              const count = voteCounts[idx] || 0;
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={idx} className="relative p-3 rounded-lg border border-silver-mist overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-vellum"
                    style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="text-lg text-ink">{opt}</span>
                    <span className="text-base text-slate-text font-semibold tabular-nums">
                      {pct}% · {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pinned 영역 (강사가 강조한 내용) */}
      {pinnedPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-2xl text-ochre mb-3 flex items-center gap-2" style={{ fontWeight: 700 }}>
            <RiPushpinFill size={20} />
            지금 주목
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedPosts.map((p) => (
              <div
                key={p.id}
                className="p-6 bg-buttercup border-2 border-ochre/30 rounded-xl shadow-[--shadow-card]"
              >
                <p className="text-2xl text-ink whitespace-pre-wrap leading-snug font-medium">
                  {p.content}
                </p>
                <p className="text-sm text-ochre mt-3">— {p.authorName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일반 포스트잇 그리드 */}
      <div>
        <h2
          className="font-display text-xl text-graphite mb-3"
          style={{ fontWeight: 700, letterSpacing: "-0.4px" }}
        >
          포스트잇 ({otherPosts.length})
        </h2>
        {otherPosts.length === 0 && pinnedPosts.length === 0 ? (
          <p className="text-center text-ash-text py-16 text-lg">
            아직 등록된 포스트잇이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {otherPosts.slice(0, 18).map((p) => (
              <div
                key={p.id}
                className="p-5 bg-chalk-card border border-silver-mist rounded-xl shadow-[--shadow-card]"
              >
                {p.type === "image" && p.fileUrl && isSafeExternalUrl(p.fileUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.fileUrl} alt={p.fileMeta?.name || "이미지"} className="w-full rounded-lg mb-2" />
                ) : (
                  <p className="text-lg text-ink whitespace-pre-wrap leading-snug">{p.content}</p>
                )}
                <p className="text-xs text-slate-text mt-3">— {p.authorName}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 최근 채팅 (작은 영역) */}
      {recentMessages.length > 0 && (
        <div className="mt-10">
          <h2
            className="font-display text-base text-slate-text mb-2 uppercase tracking-wider"
            style={{ fontWeight: 600 }}
          >
            최근 대화
          </h2>
          <div className="space-y-1">
            {recentMessages.map((m) => (
              <div key={m.id} className="text-sm text-ink">
                <span className="text-ash-text">{m.authorName}:</span>{" "}
                <span className="text-graphite">{m.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스포트라이트 오버레이 — 보드에서 admin이 지정한 포스트 확대 표시 */}
      {spotlightPost && (
        <div className="fixed inset-0 z-50 bg-graphite/80 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="max-w-3xl w-full bg-chalk-card rounded-2xl shadow-[--shadow-card] p-10">
            <p className="text-xs text-slate-text uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <RiFocus3Line size={14} />
              스포트라이트
            </p>
            {spotlightPost.type === "image" &&
            spotlightPost.fileUrl &&
            isSafeExternalUrl(spotlightPost.fileUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={spotlightPost.fileUrl}
                alt={spotlightPost.fileMeta?.name || "이미지"}
                className="w-full max-h-[60vh] object-contain rounded-lg mb-4"
              />
            ) : null}
            {spotlightPost.content && (
              <p className="text-3xl md:text-4xl text-ink whitespace-pre-wrap leading-snug font-medium">
                {spotlightPost.content}
              </p>
            )}
            <div className="flex items-center justify-between mt-6">
              <p className="text-lg text-ochre">— {spotlightPost.authorName}</p>
              {reactionTotal(spotlightPost.reactions) > 0 && (
                <p className="text-base text-slate-text">
                  공감 {reactionTotal(spotlightPost.reactions)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
