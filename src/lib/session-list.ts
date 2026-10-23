// 관리자 세션 목록 — 검색·상태 필터·정렬 (P1-05)
import type { Session, SessionStatus } from "./firestore";

export type SessionStatusFilter = "visible" | SessionStatus;
export type SessionSortMode = "recent" | "eventDate" | "created";

export const STATUS_LABEL: Record<SessionStatus, string> = {
  active: "진행 중",
  ended: "종료",
  archived: "보관",
};

export const STATUS_HELP: Record<SessionStatus, string> = {
  active: "교육생이 입장할 수 있습니다.",
  ended: "새 입장이 차단됩니다. 기존 내용은 그대로 볼 수 있고 다시 진행 중으로 바꿀 수 있습니다.",
  archived: "목록 기본 보기에서 숨기고 새 입장을 차단합니다. 데이터는 남아 있어 보관 해제로 되돌릴 수 있습니다.",
};

export const STATUS_FILTERS: { key: SessionStatusFilter; label: string }[] = [
  { key: "visible", label: "보관 제외 전체" },
  { key: "active", label: "진행 중" },
  { key: "ended", label: "종료" },
  { key: "archived", label: "보관" },
];

export const SORT_MODES: { key: SessionSortMode; label: string }[] = [
  { key: "recent", label: "최근 사용순" },
  { key: "eventDate", label: "교육일순" },
  { key: "created", label: "생성일순" },
];

type ListSession = Pick<Session, "title" | "status" | "createdAt" | "lastUsedAt" | "eventDate">;

export function sessionStatus(s: Pick<Session, "status">): SessionStatus {
  return s.status || "active";
}

const millis = (t: { toMillis?: () => number } | null | undefined) => t?.toMillis?.() ?? 0;

/** 최근 사용 = 관리자가 마지막으로 보드에 들어간 시각, 기록이 없으면 생성 시각 */
export function lastUsedMillis(s: ListSession): number {
  return Math.max(millis(s.lastUsedAt), millis(s.createdAt));
}

export function filterSessions<T extends ListSession>(
  sessions: T[],
  { query = "", status = "visible" }: { query?: string; status?: SessionStatusFilter }
): T[] {
  const q = query.trim().toLowerCase();
  return sessions.filter((s) => {
    const st = sessionStatus(s);
    if (status === "visible" ? st === "archived" : st !== status) return false;
    return !q || s.title.toLowerCase().includes(q);
  });
}

export function sortSessions<T extends ListSession>(sessions: T[], mode: SessionSortMode): T[] {
  return [...sessions].sort((a, b) => {
    if (mode === "eventDate") {
      // 교육일이 없는 세션은 뒤로, 같으면 최근 사용순
      if (!!a.eventDate !== !!b.eventDate) return a.eventDate ? -1 : 1;
      if (a.eventDate && b.eventDate && a.eventDate !== b.eventDate) return b.eventDate.localeCompare(a.eventDate);
      return lastUsedMillis(b) - lastUsedMillis(a);
    }
    if (mode === "created") return millis(b.createdAt) - millis(a.createdAt);
    return lastUsedMillis(b) - lastUsedMillis(a);
  });
}

/** "2026-10-23" → "2026. 10. 23." (교육일은 날짜만 저장하므로 시간대 변환 없음) */
export function formatEventDate(value: string | null | undefined): string {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}. ${m[2]}. ${m[3]}.` : "";
}
