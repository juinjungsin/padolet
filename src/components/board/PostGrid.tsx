"use client";

import { Post } from "@/lib/firestore";
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
    <div data-testid="post-board" className="p-4 columns-1 min-[520px]:columns-2 xl:columns-3 2xl:columns-4 gap-4">
      {visible.map((post) => (
        <PostCard key={post.id} post={post} ctx={ctx} />
      ))}
    </div>
  );
}
