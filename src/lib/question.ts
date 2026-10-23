// 질문 상태 관리 규칙 (P1-03) — 질문 목록·강사 진행 요약·보고서가 같은 기준을 쓴다
import type { Post, QuestionStatus } from "./firestore";
import { getPostKind, matchesQuery } from "./post-kind";

export const QUESTION_STATUSES: { key: QuestionStatus; label: string }[] = [
  { key: "open", label: "접수" },
  { key: "answering", label: "답변 중" },
  { key: "resolved", label: "해결" },
];

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  open: "접수",
  answering: "답변 중",
  resolved: "해결",
};

/** 미답변 = 접수 상태 (강사가 아직 손대지 않은 질문). 답변 중·해결은 제외 */
export const UNANSWERED_HELP = "미답변은 아직 '접수' 상태인 질문입니다. 강사가 '답변 중'이나 '해결'로 바꾸면 빠집니다.";

export function isQuestion(post: Pick<Post, "kind" | "isQuestion">): boolean {
  return getPostKind(post) === "question";
}

export function questionStatus(post: Pick<Post, "questionStatus">): QuestionStatus {
  return post.questionStatus ?? "open";
}

export function isUnanswered(post: Post): boolean {
  return isQuestion(post) && questionStatus(post) === "open";
}

export function countUnanswered(posts: Post[]): number {
  return posts.filter(isUnanswered).length;
}

export function meTooCount(post: Pick<Post, "meToo">): number {
  return post.meToo?.length ?? 0;
}

/** 내 질문 — 직접 쓴 질문 + 강사가 내 대화 메시지를 옮긴 질문 */
export function isMyQuestion(post: Post, uid: string | undefined): boolean {
  if (!uid) return false;
  return post.authorId === uid || post.originalAuthorId === uid;
}

export type QuestionStatusFilter = QuestionStatus | "all";
export type QuestionSortMode = "latest" | "meToo";

export interface QuestionFilter {
  status?: QuestionStatusFilter;
  mineUid?: string;
  moduleId?: string | null;
  query?: string;
}

export function filterQuestions(posts: Post[], f: QuestionFilter): Post[] {
  return posts.filter(
    (p) =>
      isQuestion(p) &&
      (!f.status || f.status === "all" || questionStatus(p) === f.status) &&
      (!f.mineUid || isMyQuestion(p, f.mineUid)) &&
      (!f.moduleId || p.moduleId === f.moduleId) &&
      matchesQuery(p, f.query ?? "")
  );
}

const millis = (t: { toMillis?: () => number } | null | undefined) => t?.toMillis?.() ?? 0;

/** 최신순 / 공감순('저도 궁금해요' 많은 순, 동률이면 최신) */
export function sortQuestions(posts: Post[], mode: QuestionSortMode): Post[] {
  return [...posts].sort((a, b) => {
    if (mode === "meToo") {
      const diff = meTooCount(b) - meTooCount(a);
      if (diff !== 0) return diff;
    }
    return millis(b.createdAt) - millis(a.createdAt);
  });
}
