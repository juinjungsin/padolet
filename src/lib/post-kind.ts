// 게시물 유형·필터·정렬 규칙 (P1-02) — 보드·자료 목록·보고서가 같은 규칙을 쓴다
import type { Post, PostColor, PostKind, ReactionMap } from "./firestore";

export const POST_KINDS: { key: PostKind; label: string; adminOnly?: boolean }[] = [
  { key: "general", label: "일반" },
  { key: "question", label: "질문" },
  { key: "material", label: "자료" },
  { key: "prompt", label: "프롬프트" },
  { key: "notice", label: "공지", adminOnly: true },
];

export const POST_KIND_LABEL: Record<PostKind, string> = Object.fromEntries(
  POST_KINDS.map((k) => [k.key, k.label])
) as Record<PostKind, string>;

type KindSource = Pick<Post, "kind" | "isQuestion">;

/** 이전 데이터(kind 없음)는 질문 표시가 있으면 질문, 아니면 일반으로 읽는다 */
export function getPostKind(post: KindSource): PostKind {
  if (post.kind && post.kind in POST_KIND_LABEL) return post.kind;
  return post.isQuestion ? "question" : "general";
}

/**
 * 강사(세션 관리자) 게시물 여부.
 * 신규 글은 authorRole로, 이전 글은 작성자가 세션 소유자인지로 판단한다.
 */
export function isInstructorPost(post: Pick<Post, "authorRole" | "authorId">, sessionOwnerId?: string): boolean {
  if (post.authorRole) return post.authorRole === "admin";
  return !!sessionOwnerId && post.authorId === sessionOwnerId;
}

/** 자료 목록에 보이는 게시물 — 자료·프롬프트 유형, 또는 파일·이미지·링크가 있는 글 (공지 제외) */
export function isMaterialLike(post: Pick<Post, "kind" | "isQuestion" | "type">): boolean {
  const kind = getPostKind(post);
  if (kind === "notice" || kind === "question") return false;
  return kind === "material" || kind === "prompt" || post.type === "file" || post.type === "image" || post.type === "link";
}

export interface PostFilter {
  query?: string;
  kind?: PostKind | null;
  instructorOnly?: boolean;
  color?: PostColor | null;
  /** 현재 실습 모듈별 보기 */
  moduleId?: string | null;
  sessionOwnerId?: string;
}

/** 검색 대상: 제목·본문·사용 목적·작성자·원본 파일명 (첨부 내부 전문 검색은 범위 밖) */
export function matchesQuery(post: Post, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [post.title, post.content, post.purpose, post.authorName, post.fileMeta?.name].some((v) =>
    v?.toLowerCase().includes(q)
  );
}

export function filterPosts(posts: Post[], f: PostFilter): Post[] {
  return posts.filter(
    (p) =>
      matchesQuery(p, f.query ?? "") &&
      (!f.kind || getPostKind(p) === f.kind) &&
      (!f.instructorOnly || isInstructorPost(p, f.sessionOwnerId)) &&
      (!f.color || (p.color || "yellow") === f.color) &&
      (!f.moduleId || p.moduleId === f.moduleId)
  );
}

export type PostSortMode = "default" | "latest" | "reactions";

const millis = (t: { toMillis?: () => number } | null | undefined) => t?.toMillis?.() ?? 0;

export function reactionCount(reactions: ReactionMap | undefined): number {
  return Object.values(reactions ?? {}).reduce((sum, list) => sum + (list?.length ?? 0), 0);
}

/**
 * 정렬 규칙 (화면에 안내):
 * 1) 고정된 글이 항상 먼저 — 고정끼리는 최근에 고정한 순
 * 2) 나머지는 선택한 기준 — 등록순(보드 배치 순서) / 최신순 / 공감순(동률이면 등록순)
 */
export function sortPosts(posts: Post[], mode: PostSortMode): Post[] {
  return [...posts].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) {
      const diff = millis(b.pinnedAt) - millis(a.pinnedAt);
      if (diff !== 0) return diff;
    }
    if (mode === "latest") return millis(b.createdAt) - millis(a.createdAt);
    if (mode === "reactions") {
      const diff = reactionCount(b.reactions) - reactionCount(a.reactions);
      if (diff !== 0) return diff;
    }
    return a.gridIndex - b.gridIndex;
  });
}

export const SORT_RULE_HELP = "고정된 글이 항상 먼저 보이고, 나머지는 선택한 순서로 정렬됩니다.";
