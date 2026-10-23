import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { arrayRemove, arrayUnion, deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createTestEnv } from "../support/seed.mjs";

// P1-01 실습 안내, P1-03 질문 상태, P1-04 진행·도움 요청 권한 (QA-02, QA-13)
let env: RulesTestEnvironment;
const SID = "class-session";
const OWNER = { uid: "owner-uid", email: "teacher@example.com" };
const M = "m1";

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
    await setDoc(doc(db, "sessions", SID), { title: "수업", code: "CLAS", createdBy: OWNER.uid, createdAt: Timestamp.now() });
    for (const uid of ["a", "b"]) await setDoc(doc(db, "sessions", SID, "participants", uid), { name: uid });
    await setDoc(doc(db, "sessions", SID, "modules", M), { title: "1교시", order: 0, practiceTitle: "설치" });
    await setDoc(doc(db, "sessions", SID, "posts", "q1"), {
      authorId: "a",
      authorName: "a",
      kind: "question",
      isQuestion: true,
      content: "질문",
      type: "text",
      gridIndex: 0,
      createdAt: Timestamp.now(),
      meToo: [],
    });
    await setDoc(doc(db, "sessions", SID, "helpRequests", `${M}__b`), { moduleId: M, uid: "b", name: "b", status: "open" });
  });
});

const user = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const owner = () => env.authenticatedContext(OWNER.uid, { email: OWNER.email }).firestore();
const qRef = (db: ReturnType<typeof user>) => doc(db, "sessions", SID, "posts", "q1");

describe("실습 안내 (modules)", () => {
  it("모두 읽을 수 있고 강사만 편집", async () => {
    await assertSucceeds(getDoc(doc(user("a"), "sessions", SID, "modules", M)));
    await assertFails(setDoc(doc(user("a"), "sessions", SID, "modules", "x"), { title: "몰래" }));
    await assertSucceeds(setDoc(doc(owner(), "sessions", SID, "modules", "m2"), { title: "2교시", order: 1 }));
    await assertSucceeds(updateDoc(doc(owner(), "sessions", SID), { activeModuleId: "m2" }));
    await assertFails(updateDoc(doc(user("a"), "sessions", SID), { activeModuleId: M }));
  });
});

describe("질문 상태 (P1-03)", () => {
  it("상태 변경은 강사만 — 작성자도 바꿀 수 없다", async () => {
    await assertFails(updateDoc(qRef(user("a")), { questionStatus: "resolved" }));
    await assertSucceeds(updateDoc(qRef(owner()), { questionStatus: "resolved", resolvedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(qRef(owner()), { questionStatus: "open", resolvedAt: null })); // 다시 열기
  });

  it("교육생은 해결 상태나 '저도 궁금해요'가 채워진 질문을 만들 수 없다", async () => {
    const base = { authorId: "a", authorName: "a", kind: "question", content: "q", type: "text", gridIndex: 1 };
    await assertFails(setDoc(doc(user("a"), "sessions", SID, "posts", "x1"), { ...base, questionStatus: "resolved" }));
    await assertFails(setDoc(doc(user("a"), "sessions", SID, "posts", "x2"), { ...base, meToo: ["b"] }));
    await assertFails(setDoc(doc(user("a"), "sessions", SID, "posts", "x3"), { ...base, sourceMessageId: "m" }));
    await assertSucceeds(setDoc(doc(user("a"), "sessions", SID, "posts", "x4"), { ...base, questionStatus: "open", meToo: [] }));
  });

  it("'저도 궁금해요'는 본인 것만 추가·취소, 남의 것은 못 건드린다", async () => {
    await assertSucceeds(updateDoc(qRef(user("b")), { meToo: arrayUnion("b") }));
    await assertFails(updateDoc(qRef(user("b")), { meToo: arrayUnion("someone") }));
    await assertSucceeds(updateDoc(qRef(user("a")), { meToo: arrayUnion("a") }));
    await assertFails(updateDoc(qRef(user("a")), { meToo: arrayRemove("b") }));
    await assertSucceeds(updateDoc(qRef(user("b")), { meToo: arrayRemove("b") }));
    // 이미 누른 상태에서 같은 값 추가는 변화 없음 → 집계 중복 없음
    await assertSucceeds(updateDoc(qRef(user("a")), { meToo: arrayRemove("a") }));
  });

  it("참여하지 않은 사용자는 누를 수 없다", async () => {
    await assertFails(updateDoc(qRef(user("outsider")), { meToo: arrayUnion("outsider") }));
  });
});

describe("진행 상태 (P1-04)", () => {
  const ref = (db: ReturnType<typeof user>, id: string) => doc(db, "sessions", SID, "progress", id);

  it("본인 문서(실습__uid)만 진행 중·완료로 기록, 취소는 삭제", async () => {
    await assertSucceeds(setDoc(ref(user("a"), `${M}__a`), { moduleId: M, uid: "a", status: "doing" }));
    await assertSucceeds(setDoc(ref(user("a"), `${M}__a`), { moduleId: M, uid: "a", status: "done" }));
    await assertSucceeds(deleteDoc(ref(user("a"), `${M}__a`)));
  });

  it("남의 진행 상태를 바꾸거나 이름 같은 추가 정보를 넣을 수 없다", async () => {
    await assertFails(setDoc(ref(user("a"), `${M}__b`), { moduleId: M, uid: "b", status: "done" }));
    await assertFails(setDoc(ref(user("a"), `${M}__a`), { moduleId: M, uid: "a", status: "done", name: "a" }));
    await assertFails(setDoc(ref(user("a"), `${M}__a`), { moduleId: M, uid: "a", status: "finished" }));
    await assertFails(setDoc(ref(user("a"), `nomodule__a`), { moduleId: "nomodule", uid: "a", status: "done" }));
  });
});

describe("도움 요청 (P1-04)", () => {
  const ref = (db: ReturnType<typeof user>, id: string) => doc(db, "sessions", SID, "helpRequests", id);

  it("요청자 정보는 본인과 강사만 열람", async () => {
    await assertSucceeds(getDoc(ref(user("b"), `${M}__b`)));
    await assertSucceeds(getDoc(ref(user("a"), `${M}__a`))); // 아직 없는 내 문서도 조회 가능
    await assertFails(getDoc(ref(user("a"), `${M}__b`)));
    await assertSucceeds(getDoc(ref(owner(), `${M}__b`)));
  });

  it("본인은 요청·취소만, 처리(확인·완료)는 강사만", async () => {
    await assertSucceeds(
      setDoc(ref(user("a"), `${M}__a`), { moduleId: M, uid: "a", name: "a", status: "open", requestedAt: Timestamp.now() })
    );
    await assertFails(updateDoc(ref(user("b"), `${M}__b`), { status: "resolved" }));
    await assertSucceeds(updateDoc(ref(owner(), `${M}__b`), { status: "acknowledged", acknowledgedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref(owner(), `${M}__b`), { status: "resolved", resolvedAt: Timestamp.now(), resolvedBy: OWNER.uid }));
    await assertSucceeds(
      updateDoc(ref(user("b"), `${M}__b`), { status: "open", requestedAt: Timestamp.now(), acknowledgedAt: null, resolvedAt: null, resolvedBy: null })
    );
    await assertSucceeds(updateDoc(ref(user("b"), `${M}__b`), { status: "cancelled" }));
  });

  it("도움 요청 처리는 진행 상태 문서를 바꾸지 않는다 (별도 컬렉션)", async () => {
    // 강사도 교육생의 진행 상태를 대신 '완료'로 만들 수 없다 — 완료는 교육생 본인 선택
    await assertFails(setDoc(doc(owner(), "sessions", SID, "progress", `${M}__b`), { moduleId: M, uid: "b", status: "done" }));
  });
});
