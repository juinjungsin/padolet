"use client";

import { useState } from "react";
import { Post, updatePost } from "@/lib/firestore";
import { rankBefore } from "@/lib/board-layout";
import { filterPosts, PostFilter, PostSortMode, sortPosts } from "@/lib/post-kind";
import WaveDecor from "@/components/ui/WaveDecor";
import PostCard, { PostCardContext } from "@/components/board/PostCard";

export type { PostSortMode } from "@/lib/post-kind";

interface PostGridProps {
  /** 세션 전체 게시물 (null = 불러오는 중) — 구독은 보드 화면에서 한 번만 */
  posts: Post[] | null;
  filter: PostFilter;
  sortMode: PostSortMode;
  ctx: PostCardContext;
}

/** 기존 보드 보기 — 포스트잇 카드 벽 */
export default function PostGrid({ posts, filter, sortMode, ctx }: PostGridProps) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canMove = (p: Post) => !busy && !ctx.locked && (ctx.isAdmin || p.authorId === ctx.currentUserId);
  async function moveBefore(id: string, target: string) {
    const post = posts?.find(p => p.id === id);
    if (!post || id === target || !canMove(post) || sortMode !== "default") return;
    setBusy(true); setError("");
    try { await updatePost(ctx.sessionId, id, { gridIndex: rankBefore(posts!, id, target) }); }
    catch { setError("위치를 바꾸지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  if (posts === null) {
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        포스트잇을 불러오는 중...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="relative flex-1 min-h-[280px] p-12 text-center overflow-hidden">
        <p className="relative z-10 text-base font-semibold text-graphite">아직 등록된 포스트잇이 없습니다.</p>
        <p className="relative z-10 mt-1 text-sm text-slate-text">위 입력창에 첫 글을 남겨 보세요.</p>
        <WaveDecor />
      </div>
    );
  }

  const visible = sortPosts(filterPosts(posts, filter), sortMode);

  if (visible.length === 0) {
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        {filter.query?.trim()
          ? `“${filter.query}”에 해당하는 포스트잇이 없습니다.`
          : "조건에 맞는 포스트잇이 없습니다. 필터를 바꿔 보세요."}
      </div>
    );
  }

  return (
    <div>
    {error && <p role="alert" className="px-4 pt-3 text-red-700">{error}</p>}
    <p className="px-4 pt-3 text-xs text-slate-text">배치순에서는 이동 손잡이를 다른 카드 위로 끌어 순서를 바꿀 수 있습니다. 메뉴의 ‘제목·색상·위치 변경’에서도 위치를 지정할 수 있습니다.</p>
    <div data-testid="post-board" className="p-4 columns-1 min-[520px]:columns-2 xl:columns-3 2xl:columns-4 gap-4">
      {visible.map((post) => (
        <div key={post.id} className="break-inside-avoid" onDragOver={e => { if (sortMode === "default") e.preventDefault(); }} onDrop={e => { e.preventDefault(); void moveBefore(e.dataTransfer.getData("application/x-padolet-post"), post.id!); }}>
          {canMove(post) && sortMode === "default" && <div draggable onDragStart={e => e.dataTransfer.setData("application/x-padolet-post", post.id!)} className="cursor-grab text-xs px-2 py-1 text-slate-text" title="다른 카드 앞으로 이동">⠿ 위치 이동</div>}
          <PostCard post={post} ctx={ctx} />
        </div>
      ))}
    </div>
    </div>
  );
}
