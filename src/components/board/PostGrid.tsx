"use client";

import { useEffect, useState } from "react";
import { Post, onPosts, deletePost, pinPost, editPost, canEditWindow } from "@/lib/firestore";
import { isSafeExternalUrl } from "@/lib/url-safe";
import Card from "@/components/ui/Card";
import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiPushpinFill,
  RiPushpin2Line,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
} from "react-icons/ri";

function renderTextWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part) && isSafeExternalUrl(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-signal-blue break-all hover:underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

interface PostGridProps {
  sessionId: string;
  isAdmin: boolean;
  /** 현재 사용자(참여자) ID — 본인 작성물 편집 권한 판정용 */
  currentUserId?: string;
  /** 검색어 — 빈 값이면 전체 */
  searchQuery?: string;
}

export default function PostGrid({ sessionId, isAdmin, currentUserId, searchQuery = "" }: PostGridProps) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const unsub = onPosts(sessionId, setPosts);
    return () => unsub();
  }, [sessionId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  async function handleDelete(postId: string) {
    if (!postId) return;
    if (!confirm("이 포스트잇을 삭제하시겠습니까?")) return;
    await deletePost(sessionId, postId);
  }

  async function handleTogglePin(post: Post) {
    if (!isAdmin || !post.id) return;
    await pinPost(sessionId, post.id, !post.pinned);
  }

  function startEdit(post: Post) {
    if (!post.id) return;
    setEditingId(post.id);
    setEditingText(post.content);
  }

  async function saveEdit(postId: string) {
    if (!editingText.trim()) return;
    await editPost(sessionId, postId, editingText.trim());
    setEditingId(null);
    setEditingText("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function handleCopy(text: string, postId: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(postId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // 검색 필터 (대소문자 무시, 작성자/본문 모두)
  const filteredPosts = searchQuery.trim()
    ? posts.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.content?.toLowerCase().includes(q) ||
          p.authorName?.toLowerCase().includes(q) ||
          p.fileMeta?.name?.toLowerCase().includes(q)
        );
      })
    : posts;

  function renderContent(post: Post) {
    switch (post.type) {
      case "link":
        if (!isSafeExternalUrl(post.content)) {
          return <p className="text-sm text-ash-text break-all">{post.content}</p>;
        }
        return (
          <a
            href={post.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal-blue text-sm break-all hover:underline"
          >
            {post.content}
          </a>
        );
      case "image":
        if (!post.fileUrl || !isSafeExternalUrl(post.fileUrl)) {
          return (
            <div className="text-xs text-ash-text">
              🖼️ {post.fileMeta?.name || "이미지"} (차단됨)
              {post.content && <p className="text-sm text-obsidian mt-1">{post.content}</p>}
            </div>
          );
        }
        return (
          <div>
            <img
              src={post.fileUrl}
              alt={post.fileMeta?.name || "이미지"}
              className="w-full rounded-lg mb-2 cursor-pointer"
              onClick={() => window.open(post.fileUrl, "_blank", "noopener,noreferrer")}
            />
            {post.content && <p className="text-sm text-obsidian">{post.content}</p>}
          </div>
        );
      case "file":
        if (!post.fileUrl || !isSafeExternalUrl(post.fileUrl)) {
          return <span className="text-sm text-ash-text">📎 {post.fileMeta?.name || "파일"} (차단됨)</span>;
        }
        return (
          <a
            href={post.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-signal-blue hover:underline"
          >
            📎 {post.fileMeta?.name || "파일"}
          </a>
        );
      default:
        return <p className="text-sm text-obsidian whitespace-pre-wrap">{renderTextWithLinks(post.content)}</p>;
    }
  }

  if (posts.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-ash-text">
        아직 등록된 포스트잇이 없습니다.
      </div>
    );
  }

  if (filteredPosts.length === 0 && searchQuery.trim()) {
    return (
      <div className="p-12 text-center text-sm text-ash-text">
        &ldquo;{searchQuery}&rdquo;에 해당하는 포스트잇이 없습니다.
      </div>
    );
  }

  return (
    <div className="p-4 columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3">
      {filteredPosts.map((post) => {
        const isOwn = !!currentUserId && post.authorId === currentUserId;
        const editable = isOwn && canEditWindow(post.createdAt);
        const isEditing = editingId === post.id;
        return (
          <Card
            key={post.id}
            className={`p-4 relative group mb-3 break-inside-avoid ${
              post.pinned ? "ring-2 ring-buttercup ring-offset-2 ring-offset-parchment" : ""
            }`}
          >
            {post.pinned && (
              <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 bg-buttercup text-ochre text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-[--shadow-card]">
                <RiPushpinFill size={10} />
                Pinned
              </span>
            )}
            <div className="flex items-center justify-between mb-2 gap-1">
              <span className="text-xs text-gravel truncate">{post.authorName}</span>
              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {isAdmin && post.id && (
                  <button
                    onClick={() => handleTogglePin(post)}
                    title={post.pinned ? "Pin 해제" : "Pin"}
                    className="text-slate hover:text-ochre cursor-pointer"
                  >
                    {post.pinned ? <RiPushpinFill size={13} /> : <RiPushpin2Line size={13} />}
                  </button>
                )}
                {editable && post.id && !isEditing && post.type === "text" && (
                  <button
                    onClick={() => startEdit(post)}
                    title="편집 (작성 후 5분 이내)"
                    className="text-slate hover:text-graphite cursor-pointer"
                  >
                    <RiEditLine size={13} />
                  </button>
                )}
                {(isAdmin || isOwn) && post.id && (
                  <button
                    onClick={() => handleDelete(post.id!)}
                    title="삭제"
                    className="text-slate hover:text-ember cursor-pointer"
                  >
                    <RiDeleteBinLine size={13} />
                  </button>
                )}
              </div>
            </div>
            {isEditing ? (
              <div>
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  rows={3}
                  className="w-full p-2 text-sm text-ink bg-vellum border border-silver-mist rounded-md outline-none focus:border-graphite resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-1 mt-1">
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-0.5 text-[10px] text-slate hover:text-graphite cursor-pointer"
                  >
                    <RiCloseLine size={12} />
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(post.id!)}
                    disabled={!editingText.trim()}
                    className="inline-flex items-center gap-0.5 text-[10px] text-graphite font-semibold hover:text-blueprint disabled:opacity-40 cursor-pointer"
                  >
                    <RiCheckLine size={12} />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              renderContent(post)
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-slate">
                {post.createdAt?.toDate?.()
                  ? post.createdAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                  : ""}
                {post.editedAt && <span className="ml-1 italic">· 수정됨</span>}
              </p>
              <button
                onClick={() => handleCopy(post.content, post.id!)}
                className="flex items-center gap-0.5 text-[10px] text-slate hover:text-obsidian cursor-pointer transition-colors"
              >
                <RiFileCopyLine size={11} />
                {copiedId === post.id ? "Copied!" : "Copy"}
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
