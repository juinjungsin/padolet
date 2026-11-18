"use client";

import { useState } from "react";
import { Post, updatePost } from "@/lib/firestore";
import { KANBAN_COLUMNS, KanbanStatus } from "@/lib/board-layout";
import { filterPosts, sortPosts, PostFilter, PostSortMode } from "@/lib/post-kind";
import PostCard, { PostCardContext } from "./PostCard";

export default function KanbanBoard({ posts, filter, sortMode, ctx }: { posts: Post[] | null; filter: PostFilter; sortMode: PostSortMode; ctx: PostCardContext }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canMove = (p: Post) => !busy && !ctx.locked && (ctx.isAdmin || p.authorId === ctx.currentUserId);
  async function move(id: string, status: KanbanStatus) {
    const post = posts?.find(p => p.id === id);
    if (!post || !canMove(post)) return;
    setBusy(true); setError("");
    try { await updatePost(ctx.sessionId, id, { kanbanStatus: status }); }
    catch { setError("상태를 변경하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  if (!posts) return <p role="status" className="p-4">칸반을 불러오는 중...</p>;
  const visible = sortPosts(filterPosts(posts, filter), sortMode);
  return <div className="p-4" data-testid="kanban-board">
    <p className="text-sm text-slate-text mb-3">포스트잇을 다른 열로 끌어 이동하거나 상태 메뉴를 선택하세요.</p>
    {error && <p role="alert">{error}</p>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{KANBAN_COLUMNS.map(col => {
      const cards = visible.filter(p => (p.kanbanStatus ?? "todo") === col.id);
      return <section key={col.id} aria-label={col.label} className="min-w-0 rounded-xl bg-vellum p-3 min-h-48" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void move(e.dataTransfer.getData("application/x-padolet-post"), col.id); }}>
        <h3 className="font-bold mb-3">{col.label} <span className="text-slate-text">{cards.length}</span></h3>
        {cards.map(post => <div key={post.id}>
          {canMove(post) && <div className="flex items-center justify-between gap-1 mb-1"><span draggable onDragStart={e => e.dataTransfer.setData("application/x-padolet-post", post.id!)} className="cursor-grab text-sm" title="다른 열로 끌어 이동">⠿ 이동</span><select aria-label={`${post.title || post.content || "포스트잇"} 칸반 상태`} value={post.kanbanStatus ?? "todo"} onChange={e => void move(post.id!, e.target.value as KanbanStatus)} className="text-sm border rounded p-1 bg-white">{KANBAN_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>}
          <PostCard post={post} ctx={ctx} />
        </div>)}
        {!cards.length && <p className="text-sm text-slate-text">이 상태의 포스트잇이 없습니다.</p>}
      </section>;
    })}</div>
  </div>;
}
