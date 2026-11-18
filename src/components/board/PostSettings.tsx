"use client";

import { useState } from "react";
import { Post, POST_COLORS, PostColor, updatePost, containsBannedWord } from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { KANBAN_COLUMNS, KanbanStatus } from "@/lib/board-layout";

export default function PostSettings({ post, sessionId, bannedWords, onClose }: {
  post: Post; sessionId: string; bannedWords: string[]; onClose: () => void;
}) {
  const [title, setTitle] = useState(post.title ?? "");
  const [color, setColor] = useState<PostColor>(post.color ?? "yellow");
  const [position, setPosition] = useState(String(post.gridIndex + 1));
  const [status, setStatus] = useState<KanbanStatus>(post.kanbanStatus ?? "todo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="my-3 space-y-3 p-3 rounded-lg border border-silver-mist bg-white" aria-label="포스트잇 설정" onSubmit={async e => {
    e.preventDefault();
    if (busy) return;
    const rank = Number(position) - 1;
    if (!position.trim() || !Number.isFinite(rank)) { setError("위치를 숫자로 입력해 주세요."); return; }
    if (containsBannedWord(title, bannedWords)) { setError("제목에 금칙어가 포함되어 있습니다."); return; }
    setBusy(true); setError("");
    try {
      await updatePost(sessionId, post.id!, { title: title.trim(), color, gridIndex: rank, kanbanStatus: status });
      onClose();
    } catch { setError("저장하지 못했습니다. 권한과 연결 상태를 확인해 주세요."); }
    finally { setBusy(false); }
  }}>
    <label className="block text-sm">포스트잇 제목<input className="block w-full border rounded p-2" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></label>
    <fieldset><legend className="text-sm mb-1">포스트잇 색상</legend><div className="flex gap-2 flex-wrap">{POST_COLORS.map(c => <label key={c} className="rounded px-2 py-1 text-sm" style={{ backgroundColor: POST_COLOR_STYLES[c].bg }}><input type="radio" name={`color-${post.id}`} checked={color === c} onChange={() => setColor(c)} /> {POST_COLOR_STYLES[c].label}</label>)}</div></fieldset>
    <label className="block text-sm">배치 위치<input className="block w-full border rounded p-2" type="number" step="any" value={position} onChange={e => setPosition(e.target.value)} /></label>
    <p className="text-xs text-slate-text">작은 숫자가 먼저 표시됩니다. 배치순 정렬에서 적용되며 고정된 글은 먼저 보입니다.</p>
    <label className="block text-sm">칸반 상태<select aria-label="칸반 상태" className="ml-2 border rounded p-2" value={status} onChange={e => setStatus(e.target.value as KanbanStatus)}>{KANBAN_COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex gap-2 justify-end"><button type="button" disabled={busy} onClick={onClose} className="px-3 py-2">취소</button><button disabled={busy} className="px-3 py-2 rounded bg-graphite text-white">{busy ? "저장 중..." : "설정 저장"}</button></div>
  </form>;
}
