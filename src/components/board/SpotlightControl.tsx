"use client";

import { useState } from "react";
import { Post, Session, SpotlightState } from "@/lib/firestore";
import { clearSpotlight, setSpotlightShowName } from "@/lib/classroom";
import { getPostKind, POST_KIND_LABEL } from "@/lib/post-kind";
import { RiFocus3Line, RiUserLine, RiUserUnfollowLine, RiCloseLine } from "react-icons/ri";

/**
 * 프로젝터 크게 보기 제어 (P2-04, 강사 전용) — 무엇이 떠 있는지, 이름 표시 여부, 해제.
 * 이름은 기본 숨김이며 강사가 켤 때만 프로젝터에 보인다.
 */
export default function SpotlightControl({ sessionId, session, posts }: { sessionId: string; session: Session; posts: Post[] | null }) {
  const [busy, setBusy] = useState(false);
  // 이전 방식(spotlightPostId만 있는 경우)도 게시물 스포트라이트로 다룬다
  const spotlight: SpotlightState | null =
    session.spotlight ?? (session.spotlightPostId ? { kind: "post", refId: session.spotlightPostId, showName: false } : null);
  if (!spotlight) return null;

  const post = spotlight.kind === "post" ? posts?.find((p) => p.id === spotlight.refId) : undefined;
  const label =
    spotlight.kind === "submission"
      ? `제출물 · ${spotlight.snapshot?.moduleTitle ?? ""}`
      : post
        ? POST_KIND_LABEL[getPostKind(post)]
        : "게시물";
  const preview =
    spotlight.kind === "submission"
      ? spotlight.snapshot?.text || spotlight.snapshot?.files[0]?.name || ""
      : post?.title || post?.content || post?.fileMeta?.name || "";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      alert("프로젝터 표시를 바꾸지 못했습니다.");
    }
    setBusy(false);
  }

  return (
    <div
      role="status"
      data-testid="spotlight-control"
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-silver-mist bg-buttercup text-sm text-ochre"
    >
      <RiFocus3Line size={16} aria-hidden />
      <span className="font-semibold whitespace-nowrap">프로젝터 표시 중 · {label}</span>
      <span className="min-w-0 flex-1 truncate text-ink">{preview}</span>
      <button
        onClick={() => run(() => setSpotlightShowName(sessionId, spotlight, !spotlight.showName))}
        disabled={busy}
        aria-pressed={spotlight.showName}
        className="touch-target inline-flex items-center gap-1 h-8 px-3 rounded-full border border-ochre/40 font-semibold hover:bg-chalk-card cursor-pointer disabled:opacity-50 whitespace-nowrap"
      >
        {spotlight.showName ? <RiUserUnfollowLine size={14} aria-hidden /> : <RiUserLine size={14} aria-hidden />}
        {spotlight.showName ? "이름 숨기기" : "이름 표시"}
      </button>
      <button
        onClick={() => run(() => clearSpotlight(sessionId))}
        disabled={busy}
        className="touch-target inline-flex items-center gap-1 h-8 px-3 rounded-full border border-ochre/40 font-semibold hover:bg-chalk-card cursor-pointer disabled:opacity-50 whitespace-nowrap"
      >
        <RiCloseLine size={14} aria-hidden />
        크게 보기 해제
      </button>
    </div>
  );
}
