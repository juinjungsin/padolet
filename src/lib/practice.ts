// 현재 실습 안내(P1-01)·진행 상태·도움 요청(P1-04) 데이터 형태와 집계 규칙
import type { Timestamp } from "firebase/firestore";

export interface PracticeLink {
  label: string;
  url: string;
}

/** sessions/{sid}/modules/{moduleId} — 강사만 편집 */
export interface Module {
  id?: string;
  /** 모듈명 (예: 2교시 — 노트 연결) */
  title: string;
  order: number;
  /** 실습 제목 */
  practiceTitle: string;
  description: string;
  /** 외부 자료 링크 */
  links: PracticeLink[];
  /** 보드의 자료 게시물 연결 (원본은 보드에 그대로) */
  materialPostIds: string[];
  /** 선택적 마감 — "YYYY-MM-DDTHH:mm" 한국 시간 */
  dueAt?: string | null;
  /** 선택적 외부 제출 링크 */
  submitUrl?: string | null;
  /** 앱 안 제출함 사용 (P2-01) */
  submissionEnabled?: boolean;
  updatedAt?: Timestamp;
}

export type ProgressStatus = "doing" | "done";

/** sessions/{sid}/progress/{moduleId}__{uid} — 이름 없이 저장 (교육생에게는 집계만 표시) */
export interface Progress {
  moduleId: string;
  uid: string;
  status: ProgressStatus;
  updatedAt?: Timestamp;
}

export type HelpStatus = "open" | "acknowledged" | "resolved" | "cancelled";

/** sessions/{sid}/helpRequests/{moduleId}__{uid} — 본인과 강사만 열람. 진행 상태와 별개 */
export interface HelpRequest {
  moduleId: string;
  uid: string;
  name: string;
  status: HelpStatus;
  requestedAt?: Timestamp | null;
  acknowledgedAt?: Timestamp | null;
  resolvedAt?: Timestamp | null;
  resolvedBy?: string | null;
}

export const HELP_STATUS_LABEL: Record<HelpStatus, string> = {
  open: "도움 요청",
  acknowledged: "확인함",
  resolved: "처리 완료",
  cancelled: "요청 취소",
};

export const PROGRESS_LABEL: Record<ProgressStatus, string> = { doing: "진행 중", done: "완료" };

/** 같은 실습·같은 참여자는 문서 하나 — 반복 클릭으로 집계가 늘지 않는다 */
export const memberDocId = (moduleId: string, uid: string) => `${moduleId}__${uid}`;

export const PROGRESS_HELP =
  "진행 상태는 교육생이 직접 고른 값입니다. 누르지 않은 교육생은 '응답 없음'으로 따로 셉니다(누적 입장 기준).";

export interface ProgressSummary {
  doing: number;
  done: number;
  /** 누적 입장 중 아직 고르지 않은 인원 (음수 방지) */
  noResponse: number;
}

export function summarizeProgress(list: Progress[], moduleId: string, totalParticipants: number): ProgressSummary {
  const mine = list.filter((p) => p.moduleId === moduleId);
  const doing = mine.filter((p) => p.status === "doing").length;
  const done = mine.filter((p) => p.status === "done").length;
  return { doing, done, noResponse: Math.max(0, totalParticipants - doing - done) };
}

/** 처리할 도움 요청 = 요청됨 또는 확인함 (처리 완료·취소 제외), 오래된 요청 먼저 */
export function pendingHelp<T extends HelpRequest>(list: T[], moduleId?: string | null): T[] {
  return list
    .filter((h) => (h.status === "open" || h.status === "acknowledged") && (!moduleId || h.moduleId === moduleId))
    .sort((a, b) => (a.requestedAt?.toMillis?.() ?? 0) - (b.requestedAt?.toMillis?.() ?? 0));
}

/** "2026-10-23T15:30" → "10월 23일 오후 3:30" (입력값 그대로 한국 시간으로 해석) */
export function formatDue(value: string | null | undefined): string {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return "";
  const hour = Number(m[4]);
  const ampm = hour < 12 ? "오전" : "오후";
  return `${Number(m[2])}월 ${Number(m[3])}일 ${ampm} ${hour % 12 || 12}:${m[5]}`;
}
