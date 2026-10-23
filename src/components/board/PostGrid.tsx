"use client";

import { useEffect, useState } from "react";
import {
  Post,
  PostColor,
  REACTIONS,
  onPosts,
  deletePost,
  pinPost,
  editPost,
  canEditWindow,
  toggleReaction,
  reactionTotal,
  setSpotlightPost,
} from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { formatBytes, formatTime } from "@/lib/format";
import { isSafeExternalUrl } from "@/lib/url-safe";
import Card from "@/components/ui/Card";
import Menu, { MenuItem } from "@/components/ui/Menu";
import Collapsible from "@/components/ui/Collapsible";
import WaveDecor from "@/components/ui/WaveDecor";
import PostComments from "@/components/board/PostComments";
import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiPushpinFill,
  RiPushpin2Line,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
  RiQuestionLine,
  RiFocus3Line,
  RiChat1Line,
  RiMoreFill,
  RiAttachment2,
  RiExternalLinkLine,
} from "react-icons/ri";

export type PostSortMode = "default" | "latest" | "reactions";

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
          className="text-blueprint underline-offset-2 hover:underline"
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
  /** 현재 사용자 표시 이름 — 댓글 작성자명 */
  currentUserName?: string;
  /** 금칙어 — 댓글 작성 시 필터링 */
  bannedWords?: string[];
  /** 검색어 — 빈 값이면 전체 */
  searchQuery?: string;
  /** 정렬 모드 (기본: 핀 + 등록순) */
  sortMode?: PostSortMode;
  /** 질문만 표시 (Q&A 필터) */
  questionsOnly?: boolean;
  /** 색상 필터 — undefined면 전체 */
  colorFilter?: PostColor | null;
  /** 현재 스포트라이트 중인 포스트 ID (프로젝터 확대 표시) */
  spotlightPostId?: string | null;
  /** 보드 잠금 (참여자 기준) — true면 리액션/편집/삭제 불가 */
  locked?: boolean;
}

const footerButton =
  "touch-target inline-flex items-center gap-1 h-8 px-2 rounded-full text-xs text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer transition-colors";

export default function PostGrid({
  sessionId,
  isAdmin,
  currentUserId,
  currentUserName,
  bannedWords = [],
  searchQuery = "",
  sortMode = "default",
  questionsOnly = false,
  colorFilter = null,
  spotlightPostId = null,
  locked = false,
}: PostGridProps) {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    const unsub = onPosts(sessionId, setPosts);
    return () => unsub();
  }, [sessionId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  function toggleComments(postId: string) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

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
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailedId(null);
      setCopiedId(postId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // 클립보드 권한 거부 등 — 실패를 알리고 다시 누를 수 있게 둔다
      setCopyFailedId(postId);
    }
  }

  async function handleToggleReaction(post: Post, key: (typeof REACTIONS)[number]["key"]) {
    if (!post.id || !currentUserId || locked) return;
    const already = (post.reactions?.[key] || []).includes(currentUserId);
    try {
      await toggleReaction(sessionId, post.id, key, currentUserId, !already);
    } catch {
      // 권한/네트워크 오류 시 무시 (다음 스냅샷에서 상태 복원)
    }
  }

  async function handleToggleSpotlight(post: Post) {
    if (!isAdmin || !post.id) return;
    const next = spotlightPostId === post.id ? null : post.id;
    await setSpotlightPost(sessionId, next);
  }

  if (posts === null) {
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        포스트잇을 불러오는 중...
      </div>
    );
  }

  // 검색 필터 (대소문자 무시, 작성자/본문/파일명)
  let filteredPosts = searchQuery.trim()
    ? posts.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.content?.toLowerCase().includes(q) ||
          p.authorName?.toLowerCase().includes(q) ||
          p.fileMeta?.name?.toLowerCase().includes(q)
        );
      })
    : posts;

  // 질문 필터 (Q&A 모드)
  if (questionsOnly) {
    filteredPosts = filteredPosts.filter((p) => p.isQuestion);
  }

  // 색상 필터
  if (colorFilter) {
    filteredPosts = filteredPosts.filter((p) => (p.color || "yellow") === colorFilter);
  }

  // 정렬 — 고정된 항목은 항상 최상단, 그 다음 정렬 기준 적용
  if (sortMode !== "default") {
    filteredPosts = [...filteredPosts].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      if (sortMode === "latest") {
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
      // reactions: 공감 많은 순 → 동률이면 등록순
      const diff = reactionTotal(b.reactions) - reactionTotal(a.reactions);
      return diff !== 0 ? diff : a.gridIndex - b.gridIndex;
    });
  }

  function renderAttachment(post: Post) {
    const name = post.fileMeta?.name || (post.type === "image" ? "이미지" : "파일");
    const safe = !!post.fileUrl && isSafeExternalUrl(post.fileUrl);
    if (!safe) {
      return (
        <p className="text-sm text-slate-text">
          {post.type === "image" ? "🖼️" : "📎"} {name} (열 수 없는 주소)
        </p>
      );
    }
    if (post.type === "image") {
      return (
        <a
          href={post.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          aria-label={`${name} 원본 이미지 새 창에서 보기`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Storage 서명 URL, 최적화 대상 아님 */}
          <img
            src={post.fileUrl}
            alt={name}
            className="w-full max-h-80 object-cover rounded-lg border border-silver-mist bg-vellum"
          />
        </a>
      );
    }
    const size = formatBytes(post.fileMeta?.size);
    return (
      <a
        href={post.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={name}
        aria-label={`${name} 열기 (${size})`}
        className="flex items-start gap-2 p-2.5 rounded-lg border border-silver-mist bg-vellum hover:border-blueprint transition-colors"
      >
        <RiAttachment2 size={18} aria-hidden className="shrink-0 mt-0.5 text-slate-text" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-blueprint line-clamp-2">{name}</span>
          <span className="block text-xs text-ash-text mt-0.5">{size}</span>
        </span>
        <RiExternalLinkLine size={16} aria-hidden className="shrink-0 mt-0.5 text-slate-text" />
      </a>
    );
  }

  function renderBody(post: Post) {
    const text = post.content?.trim();
    const attachment = post.type === "image" || post.type === "file";
    return (
      <div className="space-y-2">
        {text &&
          (post.type === "link" ? (
            isSafeExternalUrl(post.content) ? (
              <a
                href={post.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base text-blueprint hover:underline"
              >
                {post.content}
              </a>
            ) : (
              <p className="text-base text-slate-text">{post.content}</p>
            )
          ) : (
            <Collapsible>
              <p className="text-base leading-relaxed text-ink whitespace-pre-wrap">
                {renderTextWithLinks(post.content)}
              </p>
            </Collapsible>
          ))}
        {attachment && renderAttachment(post)}
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

  if (filteredPosts.length === 0) {
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        {searchQuery.trim()
          ? `“${searchQuery}”에 해당하는 포스트잇이 없습니다.`
          : questionsOnly
            ? "등록된 질문이 없습니다."
            : "해당 색상의 포스트잇이 없습니다."}
      </div>
    );
  }

  return (
    <div
      data-testid="post-board"
      className="p-4 columns-1 min-[520px]:columns-2 xl:columns-3 2xl:columns-4 gap-4"
    >
      {filteredPosts.map((post) => {
        const isOwn = !!currentUserId && post.authorId === currentUserId;
        const editable = isOwn && !locked && canEditWindow(post.createdAt);
        const isEditing = editingId === post.id;
        const isSpotlighted = !!post.id && spotlightPostId === post.id;
        const stripe = POST_COLOR_STYLES[post.color || "yellow"].dot;

        const menuItems: MenuItem[] = [];
        if (post.id) {
          if (editable && post.type === "text" && !isEditing) {
            menuItems.push({ key: "edit", label: "수정 (작성 후 5분 이내)", icon: <RiEditLine size={16} />, onSelect: () => startEdit(post) });
          }
          if (isAdmin) {
            menuItems.push({
              key: "pin",
              label: post.pinned ? "고정 해제" : "고정",
              icon: post.pinned ? <RiPushpin2Line size={16} /> : <RiPushpinFill size={16} />,
              onSelect: () => handleTogglePin(post),
            });
            menuItems.push({
              key: "spotlight",
              label: isSpotlighted ? "프로젝터 크게 보기 해제" : "프로젝터에 크게 보기",
              icon: <RiFocus3Line size={16} />,
              onSelect: () => handleToggleSpotlight(post),
              active: isSpotlighted,
            });
          }
          if (isAdmin || (isOwn && !locked)) {
            menuItems.push({ key: "delete", label: "삭제", icon: <RiDeleteBinLine size={16} />, onSelect: () => handleDelete(post.id!), danger: true });
          }
        }

        return (
          <Card
            key={post.id}
            className={`group relative mb-4 break-inside-avoid p-4 pl-5 rounded-xl ${
              isSpotlighted ? "ring-2 ring-blueprint" : post.pinned ? "ring-1 ring-graphite/30" : ""
            }`}
          >
            {/* 색상 태그 띠 — 메뉴 드롭다운이 잘리지 않도록 카드에 overflow-hidden을 쓰지 않는다 */}
            <span
              aria-hidden
              className="absolute left-0 inset-y-0 w-1.5 rounded-l-xl"
              style={{ backgroundColor: stripe }}
            />

            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-ink truncate max-w-full">{post.authorName}</span>
                <span className="text-xs text-ash-text">
                  {formatTime(post.createdAt)}
                  {post.editedAt && " · 수정됨"}
                </span>
                {post.pinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-linen text-graphite text-xs font-semibold">
                    <RiPushpinFill size={12} aria-hidden />
                    고정됨
                  </span>
                )}
                {post.isQuestion && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blossom text-graphite text-xs font-semibold">
                    <RiQuestionLine size={12} aria-hidden />
                    질문
                  </span>
                )}
                {isSpotlighted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-buttercup text-ochre text-xs font-semibold">
                    <RiFocus3Line size={12} aria-hidden />
                    프로젝터 표시 중
                  </span>
                )}
              </div>
              {menuItems.length > 0 && (
                <Menu
                  label="게시물 메뉴"
                  items={menuItems}
                  triggerClassName="touch-target -mt-1 -mr-2 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer"
                  trigger={<RiMoreFill size={18} aria-hidden />}
                />
              )}
            </div>

            {isEditing ? (
              <div>
                <label htmlFor={`edit-${post.id}`} className="sr-only">
                  포스트잇 수정
                </label>
                <textarea
                  id={`edit-${post.id}`}
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  rows={4}
                  className="w-full p-2 text-base text-ink bg-chalk-card border border-field-border rounded-md outline-none focus:border-graphite resize-y"
                  autoFocus
                />
                <div className="flex justify-end gap-1 mt-1">
                  <button onClick={cancelEdit} className={footerButton}>
                    <RiCloseLine size={14} aria-hidden />
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(post.id!)}
                    disabled={!editingText.trim()}
                    className={`${footerButton} font-semibold text-graphite disabled:opacity-40`}
                  >
                    <RiCheckLine size={14} aria-hidden />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              renderBody(post)
            )}

            <div className="flex flex-wrap items-center gap-1 mt-3 -ml-1">
              {REACTIONS.map((r) => {
                const users = post.reactions?.[r.key] || [];
                const mine = !!currentUserId && users.includes(currentUserId);
                return (
                  <button
                    key={r.key}
                    onClick={() => handleToggleReaction(post, r.key)}
                    disabled={!currentUserId || locked}
                    aria-pressed={mine}
                    aria-label={`${r.key === "up" ? "좋아요" : r.key === "heart" ? "하트" : "박수"} ${users.length}`}
                    title={locked ? "보드 잠금 중" : mine ? "리액션 취소" : "리액션"}
                    className={`touch-target inline-flex items-center gap-1 h-8 px-2 rounded-full text-sm border transition-colors cursor-pointer disabled:cursor-default ${
                      mine
                        ? "border-graphite bg-linen font-semibold"
                        : users.length > 0
                          ? "border-silver-mist"
                          : "border-transparent opacity-60 hover:opacity-100 hover:border-silver-mist"
                    }`}
                  >
                    <span aria-hidden>{r.emoji}</span>
                    {users.length > 0 && <span className="tabular-nums text-xs">{users.length}</span>}
                  </button>
                );
              })}
              <span className="flex-1" />
              {post.id && (
                <button
                  onClick={() => toggleComments(post.id!)}
                  title="댓글"
                  aria-expanded={openComments.has(post.id)}
                  className={`${footerButton} ${openComments.has(post.id) ? "text-graphite font-semibold" : ""}`}
                >
                  <RiChat1Line size={14} aria-hidden />
                  {post.commentCount ? <span className="tabular-nums">{post.commentCount}</span> : "댓글"}
                </button>
              )}
              {post.content?.trim() && (
                <button onClick={() => handleCopy(post.content, post.id!)} className={footerButton}>
                  <RiFileCopyLine size={14} aria-hidden />
                  {copiedId === post.id
                    ? "복사됨"
                    : copyFailedId === post.id
                      ? "복사 실패 — 다시 시도"
                      : "복사"}
                </button>
              )}
            </div>

            {post.id && openComments.has(post.id) && (
              <PostComments
                sessionId={sessionId}
                postId={post.id}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                isAdmin={isAdmin}
                locked={locked}
                bannedWords={bannedWords}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}
