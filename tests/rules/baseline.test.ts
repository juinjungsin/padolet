import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createTestEnv } from "../support/seed.mjs";

// 현재 보안 규칙의 기준 동작 (QA-02, QA-13) — 에뮬레이터 필요: npm run test:rules
let env: RulesTestEnvironment;
const SID = "rules-session";
const OWNER = { uid: "owner-uid", email: "teacher@example.com" };

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "admins", OWNER.email), { email: OWNER.email });
    await setDoc(doc(db, "sessions", SID), {
      title: "규칙 테스트",
      code: "RULE",
      createdBy: OWNER.uid,
      createdAt: Timestamp.now(),
      participantCount: 0,
      locked: false,
    });
    await setDoc(doc(db, "sessions", SID, "participants", "student-a"), { name: "가상A" });
    await setDoc(doc(db, "sessions", SID, "posts", "post-b"), {
      authorId: "student-b",
      authorName: "가상B",
      content: "B의 글",
      type: "text",
      gridIndex: 0,
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "sessions", SID, "posts", "post-b", "comments", "c1"), {
      authorId: "student-a",
      content: "댓글",
    });
    await setDoc(doc(db, "sessions", SID, "polls", "poll1", "votes", "student-a"), { optionIndex: 0 });
  });
});

const student = (uid = "student-a") =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const owner = () => env.authenticatedContext(OWNER.uid, { email: OWNER.email }).firestore();

describe("입장", () => {
  it("교육생은 본인 uid의 참여자 문서만 만들 수 있다", async () => {
    await assertSucceeds(setDoc(doc(student("new-student"), "sessions", SID, "participants", "new-student"), { name: "새 교육생" }));
    await assertFails(setDoc(doc(student("new-student"), "sessions", SID, "participants", "someone-else"), { name: "사칭" }));
  });

  it("교육생은 세션 문서를 수정할 수 없다 (participantCount 증가 금지 — 입장 실패 원인)", async () => {
    await assertFails(updateDoc(doc(student(), "sessions", SID), { participantCount: 1 }));
  });
});

describe("게시물", () => {
  it("참여자는 본인 이름으로 글을 쓸 수 있고, 남의 authorId는 쓸 수 없다", async () => {
    const db = student();
    await assertSucceeds(setDoc(doc(db, "sessions", SID, "posts", "p-new"), { authorId: "student-a", content: "x", gridIndex: 1 }));
    await assertFails(setDoc(doc(db, "sessions", SID, "posts", "p-fake"), { authorId: "student-b", content: "x", gridIndex: 1 }));
  });

  it("참여하지 않은 사용자는 글을 쓸 수 없다", async () => {
    await assertFails(setDoc(doc(student("outsider"), "sessions", SID, "posts", "p-x"), { authorId: "outsider", content: "x" }));
  });

  it("보드 잠금 중에는 교육생 작성이 차단되고 관리자는 가능하다", async () => {
    await assertSucceeds(updateDoc(doc(owner(), "sessions", SID), { locked: true }));
    await assertFails(setDoc(doc(student(), "sessions", SID, "posts", "p-locked"), { authorId: "student-a", content: "x" }));
    await assertSucceeds(setDoc(doc(owner(), "sessions", SID, "posts", "p-admin"), { authorId: OWNER.uid, content: "공지" }));
  });

  it("교육생은 남의 글을 고정·수정할 수 없다", async () => {
    await assertFails(updateDoc(doc(student(), "sessions", SID, "posts", "post-b"), { pinned: true }));
    await assertFails(updateDoc(doc(student(), "sessions", SID, "posts", "post-b"), { content: "변조" }));
    await assertSucceeds(updateDoc(doc(owner(), "sessions", SID, "posts", "post-b"), { pinned: true }));
  });
});

describe("세션 삭제 (deleteSession 하위 데이터 정리)", () => {
  it("세션 소유자는 댓글·투표 응답·참여자를 지울 수 있다", async () => {
    const db = owner();
    await assertSucceeds(deleteDoc(doc(db, "sessions", SID, "posts", "post-b", "comments", "c1")));
    await assertSucceeds(deleteDoc(doc(db, "sessions", SID, "polls", "poll1", "votes", "student-a")));
    await assertSucceeds(deleteDoc(doc(db, "sessions", SID, "participants", "student-a")));
    await assertSucceeds(deleteDoc(doc(db, "sessions", SID)));
  });

  it("교육생은 세션을 삭제할 수 없다", async () => {
    await assertFails(deleteDoc(doc(student(), "sessions", SID)));
  });
});

describe("관리자 범위 (QA-02)", () => {
  it("다른 위임 관리자는 남의 세션과 그 하위 데이터를 바꿀 수 없다", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "admins", "other@example.com"), { email: "other@example.com" }));
    const other = env.authenticatedContext("other-uid", { email: "other@example.com" }).firestore();
    await assertFails(updateDoc(doc(other, "sessions", SID), { title: "가로채기" }));
    await assertFails(updateDoc(doc(other, "sessions", SID, "posts", "post-b"), { pinned: true }));
    await assertFails(deleteDoc(doc(other, "sessions", SID, "participants", "student-a")));
    // 자기 세션은 만들 수 있다 (createdBy = 본인 uid)
    await assertSucceeds(setDoc(doc(other, "sessions", "own"), { title: "내 세션", code: "OWN1", createdBy: "other-uid" }));
    await assertFails(setDoc(doc(other, "sessions", "fake"), { title: "사칭", code: "FAKE", createdBy: OWNER.uid }));
  });

  it("등록되지 않은 로그인 사용자는 세션을 만들 수 없다", async () => {
    const stranger = env.authenticatedContext("stranger", { email: "stranger@example.com" }).firestore();
    await assertFails(setDoc(doc(stranger, "sessions", "s"), { title: "x", code: "XXXX", createdBy: "stranger" }));
  });
});
