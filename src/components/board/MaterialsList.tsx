"use client";

import { useState } from "react";
import { Post } from "@/lib/firestore";
import { formatBytes, formatTime } from "@/lib/format";
import {
  filterPosts,
  getPostKind,
  isInstructorPost,
  isMaterialLike,
  PostFilter,
  PostSortMode,
  sortPosts,
} from "@/lib/post-kind";
import { isSafeExternalUrl } from "@/lib/url-safe";
import {
  RiFileTextLine,
  RiImageLine,
  RiLinkM,
  RiSparkling2Line,
  RiBookOpenLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiPushpinFill,
  RiUserStarLine,
} from "react-icons/ri";

interface MaterialsListProps {
  posts: Post[] | null;
  filter: PostFilter;
  sortMode: PostSortMode;
}

function fileTypeLabel(post: Post): string {
  if (post.type === "image") return "이미지";
  if (post.type === "link") {
    try {
      return `링크 · ${new URL(post.content).hostname}`;
    } catch {
      return "링크";
    }
  }
  const ext = post.fileMeta?.name?.split(".").pop();
  return ext && ext !== post.fileMeta?.name ? ext.toUpperCase() : "파일";
}

function MaterialIcon({ post }: { post: Post }) {
  const kind = getPostKind(post);
  const cls = "shrink-0 text-graphite";
  if (kind === "prompt") return <RiSparkling2Line size={20} aria-hidden className={cls} />;
  if (post.type === "image") return <RiImageLine size={20} aria-hidden className={cls} />;
  if (post.type === "link") return <RiLinkM size={20} aria-hidden className={cls} />;
  if (post.type === "file") return <RiFileTextLine size={20} aria-hidden className={cls} />;
  return <RiBookOpenLine size={20} aria-hidden className={cls} />;
}

/** 자료 목록 보기 (P1-02) — 보드와 같은 게시물을 목록으로 보여 줄 뿐, 원본을 복제하지 않는다 */
export default function MaterialsList({ posts, filter, sortMode }: MaterialsListProps) {
  const [copied, setCopied] = useState<{ id: string; ok: boolean } | null>(null);

  if (posts === null) {
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        자료를 불러오는 중...
      </div>
    );
  }

  const materials = sortPosts(filterPosts(posts.filter(isMaterialLike), filter), sortMode);

  if (materials.length === 0) {
    const anyMaterials = posts.some(isMaterialLike);
    return (
      <div role="status" className="p-12 text-center text-slate-text">
        {anyMaterials
          ? "조건에 맞는 자료가 없습니다. 검색어나 필터를 바꿔 보세요."
          : "아직 자료가 없습니다. 유형을 '자료'로 고르거나 파일을 첨부해 올려 보세요."}
      </div>
    );
  }

  async function copyPrompt(post: Post) {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopied({ id: post.id!, ok: true });
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied({ id: post.id!, ok: false });
    }
  }

  return (
    <ul data-testid="materials-list" className="p-4 space-y-3" aria-label="자료 목록">
      {materials.map((post) => {
        const kind = getPostKind(post);
        const title =
          post.title?.trim() ||
          (post.type === "file" || post.type === "image" ? post.fileMeta?.name : "") ||
          (post.type === "link" ? post.content : post.content.split("\n")[0]) ||
          "제목 없음";
        // 제목으로 쓴 줄은 설명에서 빼고, 파일·이미지는 본문이 곧 설명
        const description =
          post.type === "link" || kind === "prompt"
            ? post.purpose ?? ""
            : post.title?.trim() || post.type === "file" || post.type === "image"
              ? post.content
              : post.content.split("\n").slice(1).join("\n");
        const url = post.type === "link" ? post.content : post.fileUrl;
        const openable = !!url && isSafeExternalUrl(url);
        const size = post.type === "file" || post.type === "image" ? formatBytes(post.fileMeta?.size) : null;

        return (
          <li key={post.id} className="bg-chalk-card border border-silver-mist rounded-xl p-4 shadow-[--shadow-card]">
            <div className="flex items-start gap-3">
              <MaterialIcon post={post} />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-graphite line-clamp-2" title={title}>
                  {post.pinned && (
                    <RiPushpinFill size={14} aria-label="고정됨" className="inline mr-1 -mt-0.5 text-graphite" />
                  )}
                  {title}
                </h3>
                {description?.trim() && (
                  <p className="mt-1 text-sm text-ink line-clamp-3 whitespace-pre-wrap">{description}</p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ash-text">
                  <span className="font-semibold text-slate-text">{kind === "prompt" ? "프롬프트" : fileTypeLabel(post)}</span>
                  {size && <span>{size}</span>}
                  <span>
                    {post.authorName}
                    {isInstructorPost(post, filter.sessionOwnerId) && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-graphite font-semibold">
                        <RiUserStarLine size={12} aria-hidden />
                        강사
                      </span>
                    )}
                  </span>
                  <span>{formatTime(post.createdAt)}</span>
                </p>
                {kind === "prompt" && post.content && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-blueprint">본문 보기</summary>
                    <pre className="mt-2 p-3 rounded-lg bg-vellum border border-silver-mist font-mono text-sm text-ink whitespace-pre-wrap">
                      {post.content}
                    </pre>
                  </details>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                {kind === "prompt" && post.content ? (
                  <button
                    onClick={() => copyPrompt(post)}
                    className="touch-target inline-flex items-center gap-1 h-9 px-3 rounded-full bg-graphite text-chalk-card text-sm font-semibold hover:bg-graphite-dark cursor-pointer"
                  >
                    <RiFileCopyLine size={16} aria-hidden />
                    {copied && copied.id === post.id ? (copied.ok ? "복사됨" : "복사 실패 — 다시 시도") : "복사"}
                  </button>
                ) : (
                  openable && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${title} 열기`}
                      className="touch-target inline-flex items-center gap-1 h-9 px-3 rounded-full border border-graphite text-graphite text-sm font-semibold hover:bg-vellum"
                    >
                      <RiExternalLinkLine size={16} aria-hidden />
                      열기
                    </a>
                  )
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
