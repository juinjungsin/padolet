import { describe, expect, it } from "vitest";
import type { Post } from "@/lib/firestore";
import { countUnanswered, filterQuestions, isMyQuestion, questionStatus, sortQuestions } from "@/lib/question";
import { formatDue, memberDocId, pendingHelp, summarizeProgress, HelpRequest, Progress } from "@/lib/practice";
import { findLocalPath } from "@/lib/local-path";

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Post["createdAt"];
const q = (p: Partial<Post>): Post =>
  ({ authorId: "u1", authorName: "가상", content: "질문", type: "text", gridIndex: 0, kind: "question", createdAt: ts(0), ...p }) as Post;
const ids = (list: { id?: string }[]) => list.map((x) => x.id);

describe("질문 상태 (P1-03)", () => {
  const posts = [
    q({ id: "legacy", kind: undefined, isQuestion: true, createdAt: ts(1) }), // 이전 데이터 — 접수로 읽음
    q({ id: "answering", questionStatus: "answering", createdAt: ts(2), meToo: ["a", "b"] }),
    q({ id: "resolved", questionStatus: "resolved", createdAt: ts(3), moduleId: "m1" }),
    q({ id: "moved", authorId: "admin", originalAuthorId: "u2", createdAt: ts(4), meToo: ["a"] }),
    q({ id: "general", kind: "general" }),
  ];

  it("상태 미설정 질문은 접수, 미답변은 접수만 센다", () => {
    expect(questionStatus(posts[0])).toBe("open");
    expect(countUnanswered(posts)).toBe(2); // legacy + moved
  });

  it("상태·내 질문·모듈 필터", () => {
    expect(ids(filterQuestions(posts, { status: "open" }))).toEqual(["legacy", "moved"]);
    expect(ids(filterQuestions(posts, { status: "resolved", moduleId: "m1" }))).toEqual(["resolved"]);
    // 대화에서 옮긴 질문은 원래 작성자의 '내 질문'
    expect(ids(filterQuestions(posts, { mineUid: "u2" }))).toEqual(["moved"]);
    expect(isMyQuestion(posts[3], "admin")).toBe(true);
    expect(filterQuestions(posts, {}).some((p) => p.id === "general")).toBe(false);
  });

  it("공감순은 '저도 궁금해요' 많은 순, 동률이면 최신", () => {
    expect(ids(sortQuestions(filterQuestions(posts, {}), "meToo"))).toEqual(["answering", "moved", "resolved", "legacy"]);
    expect(ids(sortQuestions(filterQuestions(posts, {}), "latest"))).toEqual(["moved", "resolved", "answering", "legacy"]);
  });
});

describe("진행 상태·도움 요청 (P1-04)", () => {
  it("같은 실습·참여자는 같은 문서 id (반복 클릭 중복 방지)", () => {
    expect(memberDocId("m1", "u1")).toBe("m1__u1");
  });

  it("실습별로 집계하고 응답 없는 인원을 따로 센다", () => {
    const list: Progress[] = [
      { moduleId: "m1", uid: "a", status: "done" },
      { moduleId: "m1", uid: "b", status: "doing" },
      { moduleId: "m0", uid: "c", status: "done" }, // 이전 실습 기록은 섞이지 않음
    ];
    expect(summarizeProgress(list, "m1", 5)).toEqual({ doing: 1, done: 1, noResponse: 3 });
    expect(summarizeProgress(list, "m1", 1).noResponse).toBe(0);
  });

  it("처리할 도움 요청은 요청·확인 상태만, 오래된 순", () => {
    const at = (ms: number) => ({ toMillis: () => ms }) as unknown as HelpRequest["requestedAt"];
    const list: HelpRequest[] = [
      { moduleId: "m1", uid: "a", name: "A", status: "acknowledged", requestedAt: at(2) },
      { moduleId: "m1", uid: "b", name: "B", status: "open", requestedAt: at(1) },
      { moduleId: "m1", uid: "c", name: "C", status: "resolved", requestedAt: at(0) },
      { moduleId: "m2", uid: "d", name: "D", status: "open", requestedAt: at(0) },
    ];
    expect(pendingHelp(list, "m1").map((h) => h.uid)).toEqual(["b", "a"]);
    expect(pendingHelp(list).map((h) => h.uid)).toEqual(["d", "b", "a"]);
  });

  it("마감 시각 표시", () => {
    expect(formatDue("2026-10-23T15:05")).toBe("10월 23일 오후 3:05");
    expect(formatDue("2026-10-23T00:30")).toBe("10월 23일 오전 12:30");
    expect(formatDue(null)).toBe("");
  });
});

describe("로컬 경로 감지 (P1-06)", () => {
  it("file:/// 와 obsidian:// 를 감지", () => {
    expect(findLocalPath("제 파일은 file:///C:/Users/test/노트.md 에 있어요")).toBe("file:///C:/Users/test/노트.md");
    expect(findLocalPath("obsidian://open?vault=교육&file=1일차")).toBe("obsidian://open?vault=교육&file=1일차");
    expect(findLocalPath("FILE:///D:/a.txt")).not.toBeNull();
  });
  it("일반 웹 주소와 글은 감지하지 않음", () => {
    expect(findLocalPath("https://example.com/file:///x")).toBeNull();
    expect(findLocalPath("파일 경로를 알려주세요")).toBeNull();
  });
});
