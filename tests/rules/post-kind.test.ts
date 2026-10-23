import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createTestEnv } from "../support/seed.mjs";

// P1-02 게시물 유형 권한 — 공지·강사 표시는 관리자만, 작성자 수정은 본문·제목·사용 목적만
let env: RulesTestEnvironment;
const SID = "kind-session";
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
    await setDoc(doc(db, "sessions", SID), { title: "유형", code: "KIND", createdBy: OWNER.uid, createdAt: Timestamp.now() });
    await setDoc(doc(db, "sessions", SID, "participants", "student"), { name: "가상" });
    await setDoc(doc(db, "sessions", SID, "posts", "mine"), {
      authorId: "student",
      authorName: "가상",
      kind: "question",
      isQuestion: true,
      content: "원래 질문",
      type: "text",
      gridIndex: 0,
      createdAt: Timestamp.now(),
    });
  });
});

const student = () => env.authenticatedContext("student", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const owner = () => env.authenticatedContext(OWNER.uid, { email: OWNER.email }).firestore();
const base = { authorName: "가상", content: "x", type: "text", gridIndex: 1 };

describe("작성", () => {
  it("교육생은 일반·질문·자료·프롬프트를 쓸 수 있다", async () => {
    for (const kind of ["general", "question", "material", "prompt"]) {
      await assertSucceeds(
        setDoc(doc(student(), "sessions", SID, "posts", `p-${kind}`), { ...base, authorId: "student", authorRole: "participant", kind })
      );
    }
  });

  it("교육생은 공지를 쓰거나 강사로 표시할 수 없다", async () => {
    await assertFails(setDoc(doc(student(), "sessions", SID, "posts", "n1"), { ...base, authorId: "student", kind: "notice" }));
    await assertFails(
      setDoc(doc(student(), "sessions", SID, "posts", "n2"), { ...base, authorId: "student", kind: "material", authorRole: "admin" })
    );
  });

  it("허용 목록에 없는 유형은 거부", async () => {
    await assertFails(setDoc(doc(student(), "sessions", SID, "posts", "bad"), { ...base, authorId: "student", kind: "announcement" }));
  });

  it("강사는 공지를 쓸 수 있다", async () => {
    await assertSucceeds(
      setDoc(doc(owner(), "sessions", SID, "posts", "notice"), { ...base, authorId: OWNER.uid, authorRole: "admin", kind: "notice" })
    );
  });
});

describe("작성자 수정 (5분 이내)", () => {
  it("본문·제목·사용 목적은 고칠 수 있다", async () => {
    await assertSucceeds(
      updateDoc(doc(student(), "sessions", SID, "posts", "mine"), { content: "고친 질문", editedAt: Timestamp.now() })
    );
  });

  it("유형·고정·강사 표시는 스스로 바꿀 수 없다", async () => {
    await assertFails(updateDoc(doc(student(), "sessions", SID, "posts", "mine"), { kind: "notice" }));
    await assertFails(updateDoc(doc(student(), "sessions", SID, "posts", "mine"), { pinned: true }));
    await assertFails(updateDoc(doc(student(), "sessions", SID, "posts", "mine"), { authorRole: "admin" }));
  });
});
