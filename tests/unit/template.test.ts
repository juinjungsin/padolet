import { describe, expect, it } from "vitest";
import type { Post } from "@/lib/firestore";
import type { Module } from "@/lib/practice";
import { planTemplateCopy, templatePosts } from "@/lib/template";

const post = (p: Partial<Post>): Post =>
  ({ authorId: "owner", authorName: "강사", content: "", type: "text", gridIndex: 0, ...p }) as Post;

const posts: Post[] = [
  post({ id: "material", kind: "material", title: "가이드", type: "file", fileUrl: "https://f/1", fileMeta: { name: "g.pdf", size: 1, mimeType: "application/pdf" }, gridIndex: 2, moduleId: "m1", reactions: { up: ["s1"] }, commentCount: 3, pinned: true }),
  post({ id: "notice", kind: "notice", content: "공지", gridIndex: 1 }),
  post({ id: "prompt", kind: "prompt", title: "요약", purpose: "회의 후", content: "요약해줘", gridIndex: 3 }),
  post({ id: "legacy", content: "이전 데이터 강사 글", gridIndex: 0 }), // authorRole 없음 → 소유자 작성이면 강사 글
  post({ id: "student", authorId: "s1", authorName: "교육생", content: "교육생 글" }),
  post({ id: "student-material", authorId: "s2", kind: "material", authorRole: "participant" }),
  post({ id: "question", kind: "question", content: "강사가 옮긴 질문" }),
];
const modules: Module[] = [
  { id: "m1", title: "1교시", order: 0, practiceTitle: "설치", description: "d", links: [{ label: "L", url: "https://l" }], materialPostIds: ["material", "student-material"], dueAt: "2026-10-23T10:00", submitUrl: null, submissionEnabled: true },
];

let seq = 0;
const ids = () => `new-${++seq}`;

describe("templatePosts", () => {
  it("강사 글(질문 제외)만 — 교육생 글·교육생 자료·질문은 제외", () => {
    expect(templatePosts(posts, "owner").map((p) => p.id)).toEqual(["material", "notice", "prompt", "legacy"]);
  });
});

describe("planTemplateCopy (P2-02)", () => {
  it("모듈과 강사 자료를 복사하고, 모듈의 자료 연결을 새 id로 바꾼다", () => {
    seq = 0;
    const plan = planTemplateCopy({ posts, modules, ownerId: "owner" }, { copyModules: true, copyInstructorPosts: true }, { uid: "admin2", name: "새 강사" }, ids);
    expect(plan.posts).toHaveLength(4);
    const material = plan.posts.find((p) => p.data.title === "가이드")!;
    expect(plan.modules[0].data.materialPostIds).toEqual([material.newId]); // 교육생 자료 연결은 빠짐
    expect(plan.modules[0].data.dueAt).toBeNull(); // 회차별 마감은 비움
    expect(plan.modules[0].data.submissionEnabled).toBe(true);
    expect(material.data.moduleId).toBe(plan.modules[0].newId);
    // 작성자는 복제한 강사, 리액션·댓글 수는 새로 시작
    expect(material.data).toMatchObject({ authorId: "admin2", authorName: "새 강사", authorRole: "admin", fileUrl: "https://f/1", pinned: true });
    expect(material.data).not.toHaveProperty("reactions");
    expect(material.data).not.toHaveProperty("commentCount");
    // 배치 순서 유지 (gridIndex 다시 매김)
    expect(plan.posts.map((p) => p.data.content)).toEqual(["이전 데이터 강사 글", "공지", "", "요약해줘"]);
  });

  it("옵션을 끄면 해당 항목을 복사하지 않는다", () => {
    const onlyModules = planTemplateCopy({ posts, modules, ownerId: "owner" }, { copyModules: true, copyInstructorPosts: false }, { uid: "a", name: "a" }, ids);
    expect(onlyModules.posts).toEqual([]);
    expect(onlyModules.modules[0].data.materialPostIds).toEqual([]);
    const onlyPosts = planTemplateCopy({ posts, modules, ownerId: "owner" }, { copyModules: false, copyInstructorPosts: true }, { uid: "a", name: "a" }, ids);
    expect(onlyPosts.modules).toEqual([]);
    expect(onlyPosts.posts.every((p) => !("moduleId" in p.data))).toBe(true);
  });
});
