import { describe, expect, it } from "vitest";
import type { Comment, Message, Participant, Post, Session } from "@/lib/firestore";
import { buildReportMarkdown, getAttachment, splitReply } from "@/lib/report";

// 가상 데이터 — Timestamp 대신 toDate만 가진 객체 사용
const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as unknown as Post["createdAt"];
const URL_A = "https://storage.example/v0/b/x/o/a.txt?alt=media&token=t";

const session = { title: "가상 세션", code: "TEST", createdAt: ts("2026-10-23T01:00:00Z") } as Session;
const participants = [
  { id: "u1", name: "김가상", isAnonymous: false },
  { id: "u2", name: "김가상", isAnonymous: false },
  { id: "u3", name: "익명#0001", isAnonymous: true },
] as Participant[];

const post = (p: Partial<Post>): Post =>
  ({ authorId: "u1", authorName: "김가상", content: "", type: "text", gridIndex: 0, createdAt: ts("2026-10-23T02:00:00Z"), ...p }) as Post;

const posts: Post[] = [
  post({ id: "p1", content: "본문 있는 글" }),
  post({ id: "p2", type: "file", fileUrl: URL_A, fileMeta: { name: "자료 (최종).txt", size: 300, mimeType: "text/plain" } }),
  post({ id: "p3", type: "image", fileUrl: URL_A, fileMeta: { name: "캡처.png", size: 68, mimeType: "image/png" }, pinned: true }),
  post({ id: "p4", content: "질문입니다", isQuestion: true, commentCount: 1 }),
];
const comments: Record<string, Comment[]> = {
  p4: [{ id: "c1", authorId: "t", authorName: "강사", content: "답변입니다", createdAt: ts("2026-10-23T02:10:00Z") } as Comment],
};
const messages = [
  { id: "m1", authorId: "u1", authorName: "김가상", content: "안녕하세요", type: "text", createdAt: ts("2026-10-23T02:00:00Z") },
  { id: "m2", authorId: "u2", authorName: "김가상", content: "결과.txt", type: "file", fileUrl: URL_A, fileMeta: { name: "결과.txt", size: 12000, mimeType: "text/plain" }, createdAt: ts("2026-10-23T02:01:00Z") },
  { id: "m3", authorId: "u2", authorName: "김가상", content: "", type: "image", fileUrl: URL_A, fileMeta: { name: "그림.png", size: 1, mimeType: "image/png" }, createdAt: ts("2026-10-23T02:02:00Z") },
  { id: "m4", authorId: "u3", authorName: "익명#0001", content: "비공개 내용", type: "text", hidden: true, createdAt: ts("2026-10-23T02:03:00Z") },
  { id: "m5", authorId: "u1", authorName: "김가상", content: "┃ 익명#0001: 질문\n답장 본문", type: "text", createdAt: ts("2026-10-23T02:04:00Z") },
] as Message[];

const data = { session, participants, posts, comments, messages, generatedAt: new Date("2026-10-23T03:00:00Z") };

describe("buildReportMarkdown", () => {
  const md = buildReportMarkdown(data);

  it("첨부 전용 게시물도 파일명·링크·용량·시각을 출력한다", () => {
    expect(md).toContain("첨부(파일): [자료 (최종).txt](https://storage.example/");
    expect(md).toContain("· 300 B");
    expect(md).toContain("첨부(이미지): [캡처.png](");
    expect(md).toContain("### 2. 김가상 · 2026. 10. 23. 오전 11:00");
    expect(md).not.toContain("(내용 없음)");
  });

  it("이미지만 있는 대화도 빈 줄이 되지 않는다", () => {
    expect(md).toContain("김가상: 첨부(이미지): [그림.png](");
    expect(md).toContain("첨부(파일): [결과.txt](");
    expect(md).toContain("11.7 KB");
  });

  it("누적 입장을 이름 병합 없이 센다 (동명이인 2명)", () => {
    expect(md).toContain("- 누적 입장: 3명");
    expect(md.match(/^\d+\. 김가상$/gm)).toHaveLength(2);
  });

  it("숨긴 메시지의 본문은 내보내지 않는다", () => {
    expect(md).toContain("(관리자가 숨긴 메시지)");
    expect(md).not.toContain("비공개 내용");
  });

  it("고정·질문 표시, 댓글, 답장 인용을 유지한다", () => {
    expect(md).toContain("(고정됨)");
    expect(md).toContain("(질문)");
    expect(md).toContain("  - 강사 (오전 11:10): 답변입니다");
    expect(md).toContain("답장 본문 (답글 대상 — 익명#0001: 질문)");
  });

  it("링크 URL의 괄호·공백을 인코딩해 MD 링크가 깨지지 않는다", () => {
    const md2 = buildReportMarkdown({
      ...data,
      posts: [post({ id: "x", type: "file", fileUrl: "https://s.example/a (1).txt", fileMeta: { name: "a [1].txt", size: 1, mimeType: "text/plain" } })],
    });
    expect(md2).toContain("[a \\[1\\].txt](https://s.example/a%20%281%29.txt)");
  });

  it("공유용 옵션: 링크와 참여자 명단을 뺄 수 있다", () => {
    const shared = buildReportMarkdown(data, { includeLinks: false, includeParticipants: false });
    expect(shared).not.toContain("https://storage.example");
    expect(shared).toContain("첨부(파일): 자료 (최종).txt · 300 B");
    expect(shared).not.toContain("## 참여자");
    expect(shared).toContain("- 누적 입장: 3명"); // 인원 수는 유지
  });
});

describe("보조 함수", () => {
  it("getAttachment — 텍스트 글은 첨부 없음", () => {
    expect(getAttachment(post({ content: "x" }))).toBeNull();
    expect(getAttachment(post({ type: "file", fileMeta: { name: "a", size: 0, mimeType: "" } }))?.size).toBe("0 B");
  });

  it("splitReply — 답장 형식만 분리", () => {
    expect(splitReply("┃ 이름: 인용\n본문")).toEqual({ quote: "이름: 인용", body: "본문" });
    expect(splitReply("그냥 글")).toEqual({ quote: null, body: "그냥 글" });
  });
});
