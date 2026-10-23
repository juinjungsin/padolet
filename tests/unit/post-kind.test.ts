import { describe, expect, it } from "vitest";
import type { Post } from "@/lib/firestore";
import { filterPosts, getPostKind, isInstructorPost, isMaterialLike, sortPosts } from "@/lib/post-kind";

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Post["createdAt"];
const post = (p: Partial<Post>): Post =>
  ({ authorId: "u1", authorName: "가상", content: "", type: "text", gridIndex: 0, createdAt: ts(0), ...p }) as Post;

describe("getPostKind — 이전 데이터 호환", () => {
  it("kind가 없으면 질문 표시로 판단, 그 외는 일반", () => {
    expect(getPostKind(post({}))).toBe("general");
    expect(getPostKind(post({ isQuestion: true }))).toBe("question");
    expect(getPostKind(post({ kind: "prompt" }))).toBe("prompt");
  });
  it("알 수 없는 kind 값은 안전한 기본 유형으로", () => {
    expect(getPostKind(post({ kind: "weird" as Post["kind"] }))).toBe("general");
  });
});

describe("isInstructorPost", () => {
  it("신규 글은 authorRole, 이전 글은 세션 소유자 여부", () => {
    expect(isInstructorPost(post({ authorRole: "admin" }), "owner")).toBe(true);
    expect(isInstructorPost(post({ authorRole: "participant", authorId: "owner" }), "owner")).toBe(false);
    expect(isInstructorPost(post({ authorId: "owner" }), "owner")).toBe(true);
    expect(isInstructorPost(post({ authorId: "u1" }), "owner")).toBe(false);
  });
});

describe("isMaterialLike — 자료 목록 대상", () => {
  it("자료·프롬프트·첨부·링크는 포함, 공지·질문·일반 글은 제외", () => {
    expect(isMaterialLike(post({ kind: "material" }))).toBe(true);
    expect(isMaterialLike(post({ kind: "prompt" }))).toBe(true);
    expect(isMaterialLike(post({ type: "file" }))).toBe(true);
    expect(isMaterialLike(post({ type: "link" }))).toBe(true);
    expect(isMaterialLike(post({ kind: "notice", type: "file" }))).toBe(false);
    expect(isMaterialLike(post({ isQuestion: true, type: "image" }))).toBe(false);
    expect(isMaterialLike(post({}))).toBe(false);
  });
});

describe("filterPosts — 검색·필터 조합", () => {
  const posts = [
    post({ id: "a", content: "옵시디언 설치", authorRole: "admin", kind: "material" }),
    post({ id: "b", content: "질문 있어요", isQuestion: true }),
    post({ id: "c", type: "file", fileMeta: { name: "실습_자료.PDF", size: 1, mimeType: "" } }),
    post({ id: "d", kind: "prompt", title: "회의록 요약", purpose: "회의 후 정리", content: "다음을 요약해줘" }),
  ];
  const ids = (list: Post[]) => list.map((p) => p.id);

  it("제목·본문·사용 목적·파일명을 대소문자 무시하고 검색", () => {
    expect(ids(filterPosts(posts, { query: "실습_자료.pdf" }))).toEqual(["c"]);
    expect(ids(filterPosts(posts, { query: "회의록" }))).toEqual(["d"]);
    expect(ids(filterPosts(posts, { query: "회의 후" }))).toEqual(["d"]);
  });
  it("유형·강사 게시 필터를 함께 적용", () => {
    expect(ids(filterPosts(posts, { kind: "question" }))).toEqual(["b"]);
    expect(ids(filterPosts(posts, { instructorOnly: true }))).toEqual(["a"]);
    expect(ids(filterPosts(posts, { kind: "material", instructorOnly: true, query: "설치" }))).toEqual(["a"]);
    expect(filterPosts(posts, { kind: "notice" })).toEqual([]);
  });
});

describe("sortPosts — 고정 우선 + 선택 기준", () => {
  const posts = [
    post({ id: "old", gridIndex: 0, createdAt: ts(1) }),
    post({ id: "new", gridIndex: 1, createdAt: ts(3), reactions: { up: ["x"] } }),
    post({ id: "pin-early", gridIndex: 2, createdAt: ts(2), pinned: true, pinnedAt: ts(10) }),
    post({ id: "pin-late", gridIndex: 3, createdAt: ts(0), pinned: true, pinnedAt: ts(20) }),
  ];
  const ids = (list: Post[]) => list.map((p) => p.id);

  it("고정 글이 항상 먼저, 고정끼리는 최근 고정 순", () => {
    expect(ids(sortPosts(posts, "default"))).toEqual(["pin-late", "pin-early", "old", "new"]);
    expect(ids(sortPosts(posts, "latest"))).toEqual(["pin-late", "pin-early", "new", "old"]);
    expect(ids(sortPosts(posts, "reactions"))).toEqual(["pin-late", "pin-early", "new", "old"]);
  });
});
