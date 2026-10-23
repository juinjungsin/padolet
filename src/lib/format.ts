// 화면·보고서 공통 표시 형식 — 용량과 한국 시간

/**
 * 파일 용량 표시.
 * - 미확인(값 없음)과 0바이트를 구분한다 ("크기 미확인" / "0 B")
 * - 1KB 미만은 B, 1MB 미만은 KB(소수 1자리), 그 이상은 MB·GB
 */
export function formatBytes(size: number | null | undefined): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return "크기 미확인";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

interface TimestampLike {
  toDate?: () => Date;
}

// 저장 시각은 Firestore Timestamp(UTC), 화면은 항상 한국 시간(UTC+9, 서머타임 없음)으로 표시.
// toLocale*는 브라우저·런타임의 지역화 데이터에 따라 "AM"처럼 달라질 수 있어 직접 계산한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number) => String(n).padStart(2, "0");

function toDate(ts: TimestampLike | Date | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return ts.toDate ? ts.toDate() : null;
}

function kst(d: Date) {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return {
    year: k.getUTCFullYear(),
    month: k.getUTCMonth() + 1,
    day: k.getUTCDate(),
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
  };
}

/** 오후 03:12 */
export function formatTime(ts: TimestampLike | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  const { hour, minute } = kst(d);
  return `${hour < 12 ? "오전" : "오후"} ${pad2(hour % 12 || 12)}:${pad2(minute)}`;
}

/** 2026. 10. 23. */
export function formatDate(ts: TimestampLike | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  const { year, month, day } = kst(d);
  return `${year}. ${pad2(month)}. ${pad2(day)}.`;
}

/** 2026. 10. 23. 오후 03:12 */
export function formatDateTime(ts: TimestampLike | Date | null | undefined): string {
  const d = toDate(ts);
  if (!d) return "";
  return `${formatDate(d)} ${formatTime(d)}`;
}
