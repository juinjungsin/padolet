import { beforeAll, afterAll, beforeEach, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createTestEnv } from "../support/seed.mjs";
let env: RulesTestEnvironment;
const sid = "board-tools";
beforeAll(async () => { env = await createTestEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "admins", "owner@example.com"), { email: "owner@example.com" });
    await setDoc(doc(db, "sessions", sid), { title: "보드", createdBy: "owner", locked: false });
    await setDoc(doc(db, "sessions", sid, "participants", "a"), { name: "a" });
    await setDoc(doc(db, "sessions", sid, "participants", "b"), { name: "b" });
    await setDoc(doc(db, "sessions", sid, "posts", "p"), { authorId: "a", gridIndex: 0, content: "본문", createdAt: Timestamp.fromMillis(0) });
    await setDoc(doc(db, "sessions", sid, "messages", "m"), { authorId: "a", content: "대화", createdAt: Timestamp.now() });
  });
});
const db = (uid: string, email?: string) => env.authenticatedContext(uid, email ? { email } : { firebase: { sign_in_provider: "anonymous" } }).firestore();
it("old posts allow own metadata changes but reject other authors, invalid data and content edits", async () => {
  const ref = doc(db("a"), "sessions", sid, "posts", "p");
  await assertSucceeds(updateDoc(ref, { title: "제목", color: "blue", gridIndex: -1, kanbanStatus: "doing" }));
  await assertFails(updateDoc(doc(db("b"), "sessions", sid, "posts", "p"), { color: "pink" }));
  await assertFails(updateDoc(ref, { kanbanStatus: "invalid" }));
  await assertFails(updateDoc(ref, { color: "invalid" }));
  await assertFails(updateDoc(ref, { content: "바꿈" }));
  await assertFails(updateDoc(ref, { authorId: "b" }));
});
it("only registered board administrators can rename", async () => {
  await assertSucceeds(updateDoc(doc(db("owner", "owner@example.com"), "sessions", sid), { title: "새 제목" }));
  await assertFails(updateDoc(doc(db("a"), "sessions", sid), { title: "변조" }));
  await assertFails(updateDoc(doc(db("owner", "unregistered@example.com"), "sessions", sid), { title: "변조" }));
});
it("authors can delete own messages but cannot transfer ownership or delete others", async () => {
  await assertFails(updateDoc(doc(db("a"), "sessions", sid, "messages", "m"), { authorId: "b" }));
  await assertFails(deleteDoc(doc(db("b"), "sessions", sid, "messages", "m")));
  await assertSucceeds(deleteDoc(doc(db("a"), "sessions", sid, "messages", "m")));
});
it("locks block metadata, message deletion and flow writes; admins retain access", async () => {
  const admin = db("owner", "owner@example.com");
  await updateDoc(doc(admin, "sessions", sid), { locked: true });
  await assertFails(updateDoc(doc(db("a"), "sessions", sid, "posts", "p"), { gridIndex: 2 }));
  await assertFails(deleteDoc(doc(db("a"), "sessions", sid, "messages", "m")));
  await assertFails(setDoc(doc(db("a"), "sessions", sid, "flowcharts", "a"), { title: "흐름", nodes: [], edges: [], revision: 1 }));
  await assertSucceeds(updateDoc(doc(admin, "sessions", sid, "posts", "p"), { kanbanStatus: "done" }));
  await assertSucceeds(deleteDoc(doc(admin, "sessions", sid, "messages", "m")));
});
it("flow ownership, revision checks and size limits are enforced", async () => {
  const ref = doc(db("a"), "sessions", sid, "flowcharts", "a");
  const flow = { title: "흐름", nodes: [], edges: [], revision: 1 };
  await assertSucceeds(setDoc(ref, flow));
  await assertFails(updateDoc(doc(db("b"), "sessions", sid, "flowcharts", "a"), { revision: 2 }));
  await assertFails(updateDoc(ref, { title: "충돌", revision: 1 }));
  await assertFails(updateDoc(ref, { nodes: Array(101).fill({}), revision: 2 }));
  await assertSucceeds(updateDoc(ref, { title: "수정", revision: 2 }));
});
