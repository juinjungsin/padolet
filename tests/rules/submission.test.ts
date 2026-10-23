import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch, Timestamp } from "firebase/firestore";
import { createTestEnv } from "../support/seed.mjs";

// P2-01 제출함 권한 — 제출한 교육생끼리 최신본 열람, 이력·피드백은 본인·강사, 버전은 1씩만
let env: RulesTestEnvironment;
const SID = "sub-session";
const OWNER = { uid: "owner-uid", email: "teacher@example.com" };
const OPEN = "m-open";
const CLOSED = "m-closed";

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
    await setDoc(doc(db, "sessions", SID), { title: "제출", code: "SUBM", createdBy: OWNER.uid, createdAt: Timestamp.now() });
    for (const uid of ["a", "b", "c"]) await setDoc(doc(db, "sessions", SID, "participants", uid), { name: uid });
    await setDoc(doc(db, "sessions", SID, "modules", OPEN), { title: "열림", order: 0, submissionEnabled: true });
    await setDoc(doc(db, "sessions", SID, "modules", CLOSED), { title: "닫힘", order: 1 });
  });
});

const user = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const owner = () => env.authenticatedContext(OWNER.uid, { email: OWNER.email }).firestore();
// rules-unit-testing이 돌려주는 Firestore (compat) 타입
type Db = ReturnType<typeof user>;

/** 앱과 같은 방식(이력 + 최신 문서 한 배치)으로 제출 */
function submit(db: Db, uid: string, version: number, moduleId = OPEN, opts: { versionDoc?: number; extra?: object } = {}) {
  const id = `${moduleId}__${uid}`;
  const batch = writeBatch(db);
  batch.set(doc(db, "sessions", SID, "submissions", id, "versions", String(opts.versionDoc ?? version)), {
    version: opts.versionDoc ?? version,
    text: `v${version}`,
    files: [],
    submittedAt: Timestamp.now(),
  });
  batch.set(
    doc(db, "sessions", SID, "submissions", id),
    {
      ...(version === 1 ? { moduleId, uid } : {}),
      name: uid,
      version,
      text: `v${version}`,
      files: [],
      submittedAt: Timestamp.now(),
      feedbackStatus: "none",
      ...opts.extra,
    },
    { merge: true }
  );
  return batch.commit();
}

const listModule = (db: Db) =>
  getDocs(query(collection(db, "sessions", SID, "submissions"), where("moduleId", "==", OPEN)));

describe("제출", () => {
  it("본인 제출 → 다시 제출(버전 1씩 증가)", async () => {
    await assertSucceeds(submit(user("a"), "a", 1));
    await assertSucceeds(submit(user("a"), "a", 2));
  });

  it("버전 건너뛰기·되돌리기, 이력 없는 제출은 거부", async () => {
    await assertSucceeds(submit(user("a"), "a", 1));
    await assertFails(submit(user("a"), "a", 3));
    await assertFails(submit(user("a"), "a", 1, OPEN, { versionDoc: 1 })); // 이미 있는 이력 덮어쓰기
    await assertFails(
      setDoc(doc(user("a"), "sessions", SID, "submissions", `${OPEN}__a`), { version: 2, feedbackStatus: "none", name: "a", text: "", files: [] }, { merge: true })
    );
  });

  it("제출함이 닫힌 실습, 남의 이름, 피드백 상태 위조는 거부", async () => {
    await assertFails(submit(user("a"), "a", 1, CLOSED));
    await assertFails(submit(user("a"), "b", 1));
    await assertFails(submit(user("a"), "a", 1, OPEN, { extra: { feedbackStatus: "reviewed" } }));
  });

  it("교육생은 자기 이력도 고칠 수 없다", async () => {
    await assertSucceeds(submit(user("a"), "a", 1));
    await assertFails(updateDoc(doc(user("a"), "sessions", SID, "submissions", `${OPEN}__a`, "versions", "1"), { text: "몰래 수정" }));
  });
});

describe("열람 범위", () => {
  it("제출 전에는 남의 제출물을 볼 수 없고, 제출하면 같은 실습 최신본을 볼 수 있다", async () => {
    await assertSucceeds(submit(user("a"), "a", 1));
    await assertFails(listModule(user("b")));
    await assertFails(getDoc(doc(user("b"), "sessions", SID, "submissions", `${OPEN}__a`)));
    await assertSucceeds(submit(user("b"), "b", 1));
    await assertSucceeds(listModule(user("b")));
    await assertSucceeds(getDoc(doc(user("b"), "sessions", SID, "submissions", `${OPEN}__a`)));
  });

  it("남의 이력·피드백은 제출한 교육생도 볼 수 없다", async () => {
    await assertSucceeds(submit(user("a"), "a", 1));
    await assertSucceeds(submit(user("b"), "b", 1));
    await assertFails(getDoc(doc(user("b"), "sessions", SID, "submissions", `${OPEN}__a`, "versions", "1")));
    await assertSucceeds(getDoc(doc(user("a"), "sessions", SID, "submissions", `${OPEN}__a`, "versions", "1")));
  });

  it("강사는 모두 열람하고 피드백을 남긴다 — 교육생은 피드백을 쓸 수 없다", async () => {
    await assertSucceeds(submit(user("a"), "a", 1));
    await assertSucceeds(getDocs(collection(owner(), "sessions", SID, "submissions")));
    const vRef = (db: Db) => doc(db, "sessions", SID, "submissions", `${OPEN}__a`, "versions", "1");
    const sRef = (db: Db) => doc(db, "sessions", SID, "submissions", `${OPEN}__a`);
    await assertSucceeds(updateDoc(vRef(owner()), { feedback: "좋아요", feedbackAt: Timestamp.now(), feedbackBy: OWNER.uid }));
    await assertSucceeds(updateDoc(sRef(owner()), { feedbackStatus: "reviewed", feedbackVersion: 1, feedbackAt: Timestamp.now() }));
    await assertFails(updateDoc(sRef(owner()), { text: "강사가 내용 변경" }));
    await assertFails(updateDoc(sRef(user("a")), { feedbackStatus: "reviewed" }));
  });
});
