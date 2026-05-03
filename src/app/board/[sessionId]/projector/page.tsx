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
  Post,
  Message,
  Session,
} from "@/lib/firestore";
import { isSafeExternalUrl } from "@/lib/url-safe";
import { RiPushpinFill, RiTeamLine } from "react-icons/ri";
import QRCode from "qrcode";

const DOMAIN = "padolet.vercel.app";

export default function ProjectorPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [qrUrl, setQrUrl] = useState<string>("");

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
    return () => {
      unsubS();
      unsubP();
      unsubM();
      unsubPart();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session?.code) return;
    const joinUrl = `https://${DOMAIN}/join?code=${session.code}`;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 2 }).then(setQrUrl);
  }, [session?.code]);

  const pinnedPosts = posts.filter((p) => p.pinned);
  const otherPosts = posts.filter((p) => !p.pinned);

  return (
    <div className="min-h-screen bg-parchment text-graphite p-8">
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
    </div>
  );
}
