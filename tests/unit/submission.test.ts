import { describe, expect, it } from "vitest";
import type { Participant, Session } from "@/lib/firestore";
import { isReviewed, Submission, submissionState, summarizeSubmissions } from "@/lib/submission";
import { buildReportMarkdown } from "@/lib/report";

const ts = (iso: string) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) }) as unknown as Submission["submittedAt"];
const sub = (p: Partial<Submission>): Submission =>
  ({ moduleId: "m1", uid: "a", name: "가상A", version: 1, text: "", files: [], feedbackStatus: "none", submittedAt: ts("2026-10-23T05:00:00Z"), ...p }) as Submission;

describe("제출 상태 (P2-01)", () => {
  it("미제출·제출·재제출을 구분한다", () => {
    expect(submissionState(null)).toBe("none");
    expect(submissionState(sub({ version: 1 }))).toBe("submitted");
    expect(submissionState(sub({ version: 3 }))).toBe("resubmitted");
  });

  it("피드백 완료는 최신 버전에 피드백이 있을 때만 — 다시 제출하면 대기로", () => {
    expect(isReviewed(sub({ version: 1, feedbackStatus: "reviewed", feedbackVersion: 1 }))).toBe(true);
    expect(isReviewed(sub({ version: 2, feedbackStatus: "none", feedbackVersion: 1 }))).toBe(false);
    expect(isReviewed(null)).toBe(false);
  });

  it("집계 — 교육생만, 다른 실습·강사 계정 제외", () => {
    const subs = [
      sub({ uid: "a", version: 2, feedbackStatus: "reviewed", feedbackVersion: 2 }),
      sub({ uid: "b" }),
      sub({ uid: "admin" }), // 강사 계정 제출은 세지 않음
      sub({ uid: "c", moduleId: "m0" }), // 다른 실습
    ];
    expect(summarizeSubmissions(subs, "m1", ["a", "b", "c", "d"])).toEqual({
      submitted: 2,
      resubmitted: 1,
      notSubmitted: 2,
      reviewed: 1,
    });
  });
});

describe("보고서 제출 섹션", () => {
  const data = {
    session: { title: "세션", code: "TEST", createdBy: "owner" } as Session,
    participants: [
      { id: "owner", name: "강사" },
      { id: "a", name: "가상A" },
      { id: "b", name: "가상B" },
    ] as Participant[],
    posts: [],
    comments: {},
    messages: [],
    modules: [
      { id: "m1", title: "2교시", practiceTitle: "노트 연결", order: 0, description: "", links: [], materialPostIds: [], submissionEnabled: true },
      { id: "m2", title: "3교시", practiceTitle: "제출 없음", order: 1, description: "", links: [], materialPostIds: [] },
    ],
    submissions: [
      sub({ uid: "a", version: 2, text: "결과 설명", files: [{ name: "결과.png", size: 2048, mimeType: "image/png", url: "https://s.example/r.png" }] }),
    ],
    generatedAt: new Date("2026-10-23T06:00:00Z"),
  };

  it("제출함이 켜진 실습만, 집계·회차·피드백 상태·파일 링크를 출력", () => {
    const md = buildReportMarkdown(data);
    expect(md).toContain("## 실습 제출");
    expect(md).toContain("### 2교시 — 노트 연결");
    expect(md).not.toContain("3교시");
    expect(md).toContain("제출 1명 / 교육생 2명 · 재제출 1 · 미제출 1 · 피드백 완료 0");
    expect(md).toContain("- 가상A · 2번째 제출 · 2026. 10. 23. 오후 02:00 · 피드백 대기");
    expect(md).toContain("  - 파일: [결과.png](https://s.example/r.png) · 2.0 KB");
  });

  it("공유용(명단·링크 제외)이면 제출자 이름과 링크를 빼고 출력", () => {
    const md = buildReportMarkdown(data, { includeParticipants: false, includeLinks: false });
    expect(md).toContain("- 교육생 1 · 2번째 제출");
    expect(md).not.toContain("가상A");
    expect(md).toContain("  - 파일: 결과.png · 2.0 KB");
    expect(md).not.toContain("https://s.example");
  });
});
