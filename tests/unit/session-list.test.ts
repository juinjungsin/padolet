import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/firestore";
import { filterSessions, formatEventDate, sortSessions } from "@/lib/session-list";

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Session["createdAt"];
const s = (id: string, p: Partial<Session>) => ({ id, title: id, createdAt: ts(0), ...p }) as Session & { id: string };

const sessions = [
  s("옵시디언 1일차", { status: "ended", createdAt: ts(1), eventDate: "2026-10-22" }),
  s("옵시디언 2일차", { createdAt: ts(2), lastUsedAt: ts(50), eventDate: "2026-10-23" }),
  s("지난 교육", { status: "archived", createdAt: ts(3) }),
  s("새 세션", { createdAt: ts(40) }),
];
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("filterSessions", () => {
  it("기본 보기는 보관 세션을 숨긴다 (상태 미설정은 진행 중)", () => {
    expect(ids(filterSessions(sessions, {}))).toEqual(["옵시디언 1일차", "옵시디언 2일차", "새 세션"]);
    expect(ids(filterSessions(sessions, { status: "archived" }))).toEqual(["지난 교육"]);
    expect(ids(filterSessions(sessions, { status: "active" }))).toEqual(["옵시디언 2일차", "새 세션"]);
  });
  it("세션명 검색", () => {
    expect(ids(filterSessions(sessions, { query: "옵시디언" }))).toHaveLength(2);
    expect(filterSessions(sessions, { query: "없는 이름" })).toEqual([]);
  });
});

describe("sortSessions", () => {
  it("최근 사용순 — 보드에 들어간 시각, 없으면 생성 시각", () => {
    expect(ids(sortSessions(sessions, "recent"))).toEqual(["옵시디언 2일차", "새 세션", "지난 교육", "옵시디언 1일차"]);
  });
  it("교육일순 — 교육일 최신 먼저, 미설정은 뒤로 (생성일과 혼동하지 않음)", () => {
    expect(ids(sortSessions(sessions, "eventDate"))).toEqual(["옵시디언 2일차", "옵시디언 1일차", "새 세션", "지난 교육"]);
  });
  it("생성일순", () => {
    expect(ids(sortSessions(sessions, "created"))).toEqual(["새 세션", "지난 교육", "옵시디언 2일차", "옵시디언 1일차"]);
  });
});

it("formatEventDate — 날짜 문자열만, 시간대 변환 없음", () => {
  expect(formatEventDate("2026-10-23")).toBe("2026. 10. 23.");
  expect(formatEventDate(null)).toBe("");
  expect(formatEventDate("잘못된 값")).toBe("");
});
