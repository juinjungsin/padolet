"use client";

import { useEffect, useState } from "react";
import {
  Comment,
  addComment,
  deleteComment,
  onComments,
  containsBannedWord,
} from "@/lib/firestore";
import { RiDeleteBinLine, RiSendPlane2Fill } from "react-icons/ri";

interface PostCommentsProps {
  sessionId: string;
  postId: string;
  /** 현재 사용자(참여자) ID — 본인 댓글 삭제 권한 판정용 */
  currentUserId?: string;
  /** 현재 사용자 표시 이름 — 댓글 작성자명 */
  currentUserName?: string;
  isAdmin: boolean;
  /** 보드 잠금 — true면 댓글 열람만 가능 */
  locked?: boolean;
  bannedWords?: string[];
}

/**
 * 포스트잇 댓글 스레드.
 * - 펼쳐질 때(마운트 시)에만 onComments를 구독 → 포스트가 많아도 리스너 폭증 방지.
 * - 작성/삭제는 firestore의 writeBatch로 commentCount와 함께 원자적으로 처리.
 */
export default function PostComments({
  sessionId,
  postId,
  currentUserId,
  currentUserName,
  isAdmin,
  locked = false,
  bannedWords = [],
}: PostCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onComments(sessionId, postId, setComments);
    return () => unsub();
  }, [sessionId, postId]);

  const canWrite = !!currentUserId && !!currentUserName && !locked;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !currentUserId || !currentUserName) return;
    if (locked) {
      setError("보드가 잠금 상태입니다.");
      return;
    }
    const hit = containsBannedWord(trimmed, bannedWords);
    if (hit) {
      setError(`금칙어 "${hit}" 가 포함되어 있습니다.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await addComment(sessionId, postId, {
        authorId: currentUserId,
        authorName: currentUserName,
        content: trimmed,
      });
      setText("");
    } catch {
      setError("댓글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId?: string) {
    if (!commentId) return;
    try {
      await deleteComment(sessionId, postId, commentId);
    } catch {
      // 권한/네트워크 오류 시 무시 (다음 스냅샷에서 복원)
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-silver-mist/60">
      {comments.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {comments.map((c) => {
            const own = !!currentUserId && c.authorId === currentUserId;
            return (
              <li key={c.id} className="group/comment flex items-start gap-1.5 text-xs">
                <span className="font-semibold text-gravel shrink-0">{c.authorName}</span>
                <span className="flex-1 min-w-0 text-obsidian whitespace-pre-wrap break-words">
                  {c.content}
                </span>
                {(isAdmin || (own && !locked)) && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    title="댓글 삭제"
                    className="shrink-0 text-slate hover:text-ember opacity-0 group-hover/comment:opacity-100 transition-opacity cursor-pointer"
                  >
                    <RiDeleteBinLine size={11} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canWrite ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-1">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
            }}
            placeholder="댓글 달기..."
            maxLength={500}
            className="flex-1 min-w-0 px-2 py-1 text-xs text-ink bg-vellum/70 border border-silver-mist rounded-md outline-none focus:border-graphite"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            title="댓글 등록"
            className="shrink-0 text-slate hover:text-graphite disabled:opacity-40 cursor-pointer"
          >
            <RiSendPlane2Fill size={14} />
          </button>
        </form>
      ) : locked ? (
        <p className="text-[10px] text-slate">보드 잠금 중 — 댓글 열람만 가능합니다</p>
      ) : null}
      {error && <p className="text-[10px] text-terracotta mt-1">{error}</p>}
    </div>
  );
}
