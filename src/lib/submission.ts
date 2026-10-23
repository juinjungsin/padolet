// 실습별 제출함 (P2-01) — 데이터 형태와 상태 규칙
import type { Timestamp } from "firebase/firestore";

export interface SubmissionFile {
  name: string;
  size: number;
  mimeType: string;
  /** 링크를 아는 사람이 열 수 있는 다운로드 주소 (보드 첨부와 같은 방식 — 2026-10 정책 결정) */
  url: string;
}

/**
 * sessions/{sid}/submissions/{moduleId}__{uid} — 참여자별 최신 제출.
 * 열람: 본인·강사, 그리고 같은 실습에 제출한 교육생(제출 전 베끼기 방지).
 */
export interface Submission {
  id?: string;
  moduleId: string;
  uid: string;
  name: string;
  /** 1부터 — 다시 제출할 때마다 1씩 증가 */
  version: number;
  text: string;
  files: SubmissionFile[];
  submittedAt?: Timestamp | null;
  /** 최신 버전에 대한 피드백 여부 — 다시 제출하면 none으로 돌아간다 */
  feedbackStatus: "none" | "reviewed";
  /** 피드백이 달린 가장 최근 버전 */
  feedbackVersion?: number | null;
  feedbackAt?: Timestamp | null;
}

/** .../submissions/{id}/versions/{version} — 제출 이력 (교육생은 고칠 수 없음). 본인·강사만 열람 */
export interface SubmissionVersion {
  version: number;
  text: string;
  files: SubmissionFile[];
  submittedAt?: Timestamp | null;
  feedback?: string | null;
  feedbackAt?: Timestamp | null;
  feedbackBy?: string | null;
}

export type SubmissionState = "none" | "submitted" | "resubmitted";

export const SUBMISSION_STATE_LABEL: Record<SubmissionState, string> = {
  none: "미제출",
  submitted: "제출",
  resubmitted: "재제출",
};

export const MAX_SUBMISSION_FILES = 5;

export const SUBMISSION_IDENTITY_NOTICE =
  "같은 기기·같은 브라우저로 제출해 주세요. 다른 기기나 시크릿 창에서는 새 참여자로 보여 이전 제출과 이어지지 않습니다.";

export const SUBMISSION_VISIBILITY_NOTICE =
  "이 실습에 제출하면 다른 교육생의 최신 제출물을 볼 수 있습니다. 제출 이력과 피드백은 본인과 강사만 봅니다. 첨부 파일은 링크를 아는 사람 누구나 열 수 있습니다.";

export function submissionState(sub: Pick<Submission, "version"> | null | undefined): SubmissionState {
  if (!sub) return "none";
  return sub.version > 1 ? "resubmitted" : "submitted";
}

/** 최신 버전에 피드백이 달렸는지 */
export function isReviewed(sub: Pick<Submission, "feedbackStatus" | "feedbackVersion" | "version"> | null | undefined): boolean {
  return !!sub && sub.feedbackStatus === "reviewed" && sub.feedbackVersion === sub.version;
}

export interface SubmissionSummary {
  submitted: number;
  resubmitted: number;
  notSubmitted: number;
  reviewed: number;
}

/**
 * 집계 대상 = 교육생(강사·관리자 계정 제외)의 해당 실습 제출.
 * 제출 = 1회 이상 제출한 인원(재제출 포함), 재제출 = 2회 이상, 미제출 = 교육생 중 제출 없음.
 */
export function summarizeSubmissions(subs: Submission[], moduleId: string, learnerIds: string[]): SubmissionSummary {
  const learners = new Set(learnerIds);
  const mine = subs.filter((s) => s.moduleId === moduleId && learners.has(s.uid));
  return {
    submitted: mine.length,
    resubmitted: mine.filter((s) => s.version > 1).length,
    notSubmitted: Math.max(0, learners.size - mine.length),
    reviewed: mine.filter(isReviewed).length,
  };
}

export const SUBMISSION_SUMMARY_HELP =
  "교육생(강사·관리자 계정 제외) 기준입니다. 제출은 한 번 이상 낸 인원(재제출 포함), 재제출은 두 번 이상 낸 인원입니다.";
