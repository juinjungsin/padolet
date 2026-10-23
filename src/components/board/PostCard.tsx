"use client";

import { useState } from "react";
import {
  Post,
  REACTIONS,
  ReactionKey,
  deletePost,
  pinPost,
  editPost,
  canEditWindow,
  toggleReaction,
  setSpotlightPost,
} from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { formatBytes, formatTime } from "@/lib/format";
import { getPostKind, isInstructorPost } from "@/lib/post-kind";
import { isSafeExternalUrl } from "@/lib/url-safe";
import Card from "@/components/ui/Card";
import Menu, { MenuItem } from "@/components/ui/Menu";
import Collapsible from "@/components/ui/Collapsible";
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
  RiMegaphoneLine,
  RiBookOpenLine,
  RiSparkling2Line,
  RiUserStarLine,
} from "react-icons/ri";

export interface PostCardContext {
  sessionId: string;
  isAdmin: boolean;
  /** 세션 소유자 uid — 이전 게시물의 강사 표시 판단 */
  sessionOwnerId?: string;
  currentUserId?: string;
  currentUserName?: string;
  bannedWords?: string[];
  spotlightPostId?: string | null;
  /** 보드 잠금 (참여자 기준) */
  locked?: boolean;
}

const REACTION_LABEL: Record<ReactionKey, string> = { up: "좋아요", heart: "하트", clap: "박수" };

const footerButton =
  "touch-target inline-flex items-center gap-1 h-8 px-2 rounded-full text-xs text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer transition-colors";

const badge = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold";

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

export function AttachmentView({ post }: { post: Post }) {
  const name = post.fileMeta?.name || (post.type === "image" ? "이미지" : "파일");
  if (!post.fileUrl || !isSafeExternalUrl(post.fileUrl)) {
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

export default function PostCard({ post, ctx }: { post: Post; ctx: PostCardContext }) {
  const { sessionId, isAdmin, currentUserId, spotlightPostId, locked = false } = ctx;
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [editing, setEditing] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [commentsOpen, setCommentsOpen] = useState(false);

  const kind = getPostKind(post);
  const instructor = isInstructorPost(post, ctx.sessionOwnerId);
  const isOwn = !!currentUserId && post.authorId === currentUserId;
  const editable = isOwn && !locked && canEditWindow(post.createdAt);
  const isSpotlighted = !!post.id && spotlightPostId === post.id;
  const stripe = POST_COLOR_STYLES[post.color || "yellow"].dot;

  async function handleCopy() {
    try {
      // 원문 그대로 복사 (프롬프트 줄바꿈·공백 보존)
      await navigator.clipboard.writeText(post.content);
      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      // 클립보드 권한 거부 등 — 실패를 알리고 다시 누를 수 있게 둔다
      setCopyState("failed");
    }
  }

  async function handleDelete() {
    if (!post.id || !confirm("이 포스트잇을 삭제하시겠습니까?")) return;
    await deletePost(sessionId, post.id);
  }

  async function saveEdit() {
    if (!post.id || !editingText.trim()) return;
    await editPost(sessionId, post.id, kind === "prompt" ? editingText : editingText.trim());
    setEditing(false);
  }

  async function handleToggleReaction(key: ReactionKey) {
    if (!post.id || !currentUserId || locked) return;
    const already = (post.reactions?.[key] || []).includes(currentUserId);
    try {
      await toggleReaction(sessionId, post.id, key, currentUserId, !already);
    } catch {
      // 권한/네트워크 오류 시 무시 (다음 스냅샷에서 상태 복원)
    }
  }

  const menuItems: MenuItem[] = [];
  if (post.id) {
    if (editable && post.type !== "image" && post.type !== "file" && !editing) {
      menuItems.push({
        key: "edit",
        label: "수정 (작성 후 5분 이내)",
        icon: <RiEditLine size={16} />,
        onSelect: () => {
          setEditingText(post.content);
          setEditing(true);
        },
      });
    }
    if (isAdmin) {
      menuItems.push({
        key: "pin",
        label: post.pinned ? "고정 해제" : "고정",
        icon: post.pinned ? <RiPushpin2Line size={16} /> : <RiPushpinFill size={16} />,
        onSelect: () => pinPost(sessionId, post.id!, !post.pinned),
      });
      menuItems.push({
        key: "spotlight",
        label: isSpotlighted ? "프로젝터 크게 보기 해제" : "프로젝터에 크게 보기",
        icon: <RiFocus3Line size={16} />,
        onSelect: () => setSpotlightPost(sessionId, isSpotlighted ? null : post.id!),
        active: isSpotlighted,
      });
    }
    if (isAdmin || (isOwn && !locked)) {
      menuItems.push({ key: "delete", label: "삭제", icon: <RiDeleteBinLine size={16} />, onSelect: handleDelete, danger: true });
    }
  }

  const text = post.content;
  const hasText = !!text?.trim();
  const hasAttachment = post.type === "image" || post.type === "file";
  const displayTitle =
    post.title?.trim() || (kind === "material" && hasAttachment ? post.fileMeta?.name : "") || "";

  function renderBody() {
    if (editing) {
      return (
        <div>
          <label htmlFor={`edit-${post.id}`} className="sr-only">
            포스트잇 수정
          </label>
          <textarea
            id={`edit-${post.id}`}
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            rows={4}
            className={`w-full p-2 text-ink bg-chalk-card border border-field-border rounded-md outline-none focus:border-graphite resize-y ${
              kind === "prompt" ? "font-mono text-sm" : "text-base"
            }`}
            autoFocus
          />
          <div className="flex justify-end gap-1 mt-1">
            <button onClick={() => setEditing(false)} className={footerButton}>
              <RiCloseLine size={14} aria-hidden />
              취소
            </button>
            <button
              onClick={saveEdit}
              disabled={!editingText.trim()}
              className={`${footerButton} font-semibold text-graphite disabled:opacity-40`}
            >
              <RiCheckLine size={14} aria-hidden />
              저장
            </button>
          </div>
        </div>
      );
    }

    if (kind === "prompt") {
      return (
        <div className="space-y-2">
          {post.title && <h3 className="text-base font-bold text-graphite">{post.title}</h3>}
          {post.purpose && (
            <p className="text-sm text-slate-text">
              <span className="font-semibold">사용 목적</span> · {post.purpose}
            </p>
          )}
          {hasText && (
            <Collapsible>
              <pre className="p-3 rounded-lg bg-vellum border border-silver-mist font-mono text-sm leading-relaxed text-ink whitespace-pre-wrap">
                {text}
              </pre>
            </Collapsible>
          )}
          {hasAttachment && <AttachmentView post={post} />}
          {hasText && (
            <button
              onClick={handleCopy}
              className="touch-target inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-graphite text-chalk-card text-sm font-semibold hover:bg-graphite-dark cursor-pointer"
            >
              <RiFileCopyLine size={16} aria-hidden />
              {copyState === "done" ? "복사됨" : copyState === "failed" ? "복사 실패 — 다시 시도" : "프롬프트 복사"}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {displayTitle && <h3 className="text-base font-bold text-graphite">{displayTitle}</h3>}
        {hasText &&
          (post.type === "link" ? (
            isSafeExternalUrl(text) ? (
              <a href={text} target="_blank" rel="noopener noreferrer" className="text-base text-blueprint hover:underline">
                {text}
              </a>
            ) : (
              <p className="text-base text-slate-text">{text}</p>
            )
          ) : (
            <Collapsible>
              <p
                className={`leading-relaxed text-ink whitespace-pre-wrap ${
                  kind === "notice" ? "text-lg font-semibold" : "text-base"
                }`}
              >
                {renderTextWithLinks(text)}
              </p>
            </Collapsible>
          ))}
        {hasAttachment && <AttachmentView post={post} />}
      </div>
    );
  }

  return (
    <Card
      data-post-kind={kind}
      // 공지는 강조 바탕 — Card 기본 배경·테두리 클래스보다 우선하도록 ! 표기
      className={`group relative mb-4 break-inside-avoid p-4 pl-5 rounded-xl ${
        kind === "notice" ? "bg-buttercup! border-ochre/40!" : ""
      } ${isSpotlighted ? "ring-2 ring-blueprint" : post.pinned ? "ring-1 ring-graphite/30" : ""}`}
    >
      {/* 색상 태그 띠 — 메뉴 드롭다운이 잘리지 않도록 카드에 overflow-hidden을 쓰지 않는다 */}
      <span aria-hidden className="absolute left-0 inset-y-0 w-1.5 rounded-l-xl" style={{ backgroundColor: stripe }} />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          {kind === "notice" && (
            <span className={`${badge} bg-graphite text-chalk-card`}>
              <RiMegaphoneLine size={12} aria-hidden />
              강사 공지
            </span>
          )}
          <span className="text-sm font-semibold text-ink truncate max-w-full">{post.authorName}</span>
          {instructor && kind !== "notice" && (
            <span className={`${badge} bg-linen text-graphite`}>
              <RiUserStarLine size={12} aria-hidden />
              강사
            </span>
          )}
          <span className="text-xs text-ash-text">
            {formatTime(post.createdAt)}
            {post.editedAt && " · 수정됨"}
          </span>
          {post.pinned && (
            <span className={`${badge} bg-linen text-graphite`}>
              <RiPushpinFill size={12} aria-hidden />
              고정됨
            </span>
          )}
          {kind === "question" && (
            <span className={`${badge} bg-blossom text-graphite`}>
              <RiQuestionLine size={12} aria-hidden />
              질문
            </span>
          )}
          {kind === "material" && (
            <span className={`${badge} bg-blossom text-graphite`}>
              <RiBookOpenLine size={12} aria-hidden />
              자료
            </span>
          )}
          {kind === "prompt" && (
            <span className={`${badge} bg-blossom text-graphite`}>
              <RiSparkling2Line size={12} aria-hidden />
              프롬프트
            </span>
          )}
          {isSpotlighted && (
            <span className={`${badge} bg-buttercup text-ochre`}>
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

      {renderBody()}

      <div className="flex flex-wrap items-center gap-1 mt-3 -ml-1">
        {REACTIONS.map((r) => {
          const users = post.reactions?.[r.key] || [];
          const mine = !!currentUserId && users.includes(currentUserId);
          return (
            <button
              key={r.key}
              onClick={() => handleToggleReaction(r.key)}
              disabled={!currentUserId || locked}
              aria-pressed={mine}
              aria-label={`${REACTION_LABEL[r.key]} ${users.length}`}
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
            onClick={() => setCommentsOpen((v) => !v)}
            title="댓글"
            aria-expanded={commentsOpen}
            className={`${footerButton} ${commentsOpen ? "text-graphite font-semibold" : ""}`}
          >
            <RiChat1Line size={14} aria-hidden />
            {post.commentCount ? <span className="tabular-nums">{post.commentCount}</span> : "댓글"}
          </button>
        )}
        {hasText && kind !== "prompt" && (
          <button onClick={handleCopy} className={footerButton}>
            <RiFileCopyLine size={14} aria-hidden />
            {copyState === "done" ? "복사됨" : copyState === "failed" ? "복사 실패 — 다시 시도" : "복사"}
          </button>
        )}
      </div>

      {post.id && commentsOpen && (
        <PostComments
          sessionId={sessionId}
          postId={post.id}
          currentUserId={currentUserId}
          currentUserName={ctx.currentUserName}
          isAdmin={isAdmin}
          locked={locked}
          bannedWords={ctx.bannedWords ?? []}
        />
      )}
    </Card>
  );
}
