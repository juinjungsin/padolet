// 교육 진행 데이터 접근 — 실습 안내(P1-01), 질문 상태(P1-03), 진행·도움 요청(P1-04)
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db as getDb } from "./firebase";
import type { Message, QuestionStatus } from "./firestore";
import { HelpRequest, memberDocId, Module, Progress, ProgressStatus } from "./practice";

const sessionDoc = (sid: string) => doc(getDb(), "sessions", sid);

// ---------- 실습 안내 (modules) ----------

export function onModules(sid: string, cb: (modules: Module[]) => void) {
  return onSnapshot(query(collection(getDb(), "sessions", sid, "modules"), orderBy("order", "asc")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Module))
  );
}

/** 새 모듈이면 id를 만들어 돌려준다 */
export async function saveModule(sid: string, module: Module): Promise<string> {
  const { id, ...data } = module;
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (id) {
    await setDoc(doc(getDb(), "sessions", sid, "modules", id), payload);
    return id;
  }
  const ref = await addDoc(collection(getDb(), "sessions", sid, "modules"), payload);
  return ref.id;
}

export async function deleteModule(sid: string, moduleId: string) {
  await deleteDoc(doc(getDb(), "sessions", sid, "modules", moduleId));
}

export async function setActiveModule(sid: string, moduleId: string | null) {
  await updateDoc(sessionDoc(sid), { activeModuleId: moduleId });
}

// ---------- 진행 상태 (progress) ----------

export function onModuleProgress(sid: string, moduleId: string, cb: (list: Progress[]) => void) {
  return onSnapshot(
    query(collection(getDb(), "sessions", sid, "progress"), where("moduleId", "==", moduleId)),
    (snap) => cb(snap.docs.map((d) => d.data() as Progress)),
    () => cb([])
  );
}

/** status=null이면 선택 취소 (문서 삭제) */
export async function setMyProgress(sid: string, moduleId: string, uid: string, status: ProgressStatus | null) {
  const ref = doc(getDb(), "sessions", sid, "progress", memberDocId(moduleId, uid));
  if (status === null) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, { moduleId, uid, status, updatedAt: serverTimestamp() });
}

// ---------- 도움 요청 (helpRequests) ----------

export function onMyHelp(sid: string, moduleId: string, uid: string, cb: (h: HelpRequest | null) => void) {
  return onSnapshot(
    doc(getDb(), "sessions", sid, "helpRequests", memberDocId(moduleId, uid)),
    (snap) => cb(snap.exists() ? (snap.data() as HelpRequest) : null),
    () => cb(null)
  );
}

/** 강사용 — 세션 전체 도움 요청 */
export function onHelpRequests(sid: string, cb: (list: (HelpRequest & { id: string })[]) => void) {
  return onSnapshot(
    collection(getDb(), "sessions", sid, "helpRequests"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as HelpRequest) }))),
    () => cb([])
  );
}

export async function requestHelp(sid: string, moduleId: string, uid: string, name: string, existing: boolean) {
  const ref = doc(getDb(), "sessions", sid, "helpRequests", memberDocId(moduleId, uid));
  if (!existing) {
    await setDoc(ref, { moduleId, uid, name, status: "open", requestedAt: serverTimestamp() });
    return;
  }
  // 다시 요청 — 이전 처리 기록을 비우고 새 요청 시각
  await updateDoc(ref, {
    status: "open",
    requestedAt: serverTimestamp(),
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  });
}

export async function cancelHelp(sid: string, moduleId: string, uid: string) {
  await updateDoc(doc(getDb(), "sessions", sid, "helpRequests", memberDocId(moduleId, uid)), {
    status: "cancelled",
    acknowledgedAt: null,
    resolvedAt: null,
    resolvedBy: null,
  });
}

export async function acknowledgeHelp(sid: string, helpId: string) {
  await updateDoc(doc(getDb(), "sessions", sid, "helpRequests", helpId), {
    status: "acknowledged",
    acknowledgedAt: serverTimestamp(),
  });
}

/** 도움 처리 완료 — 교육생의 진행 상태(완료 여부)는 바꾸지 않는다 */
export async function resolveHelp(sid: string, helpId: string, adminUid: string) {
  await updateDoc(doc(getDb(), "sessions", sid, "helpRequests", helpId), {
    status: "resolved",
    resolvedAt: serverTimestamp(),
    resolvedBy: adminUid,
  });
}

// ---------- 질문 상태 (posts) ----------

export async function setQuestionStatus(sid: string, postId: string, status: QuestionStatus) {
  await updateDoc(doc(getDb(), "sessions", sid, "posts", postId), {
    questionStatus: status,
    resolvedAt: status === "resolved" ? serverTimestamp() : null,
  });
}

export async function toggleMeToo(sid: string, postId: string, uid: string, on: boolean) {
  await updateDoc(doc(getDb(), "sessions", sid, "posts", postId), {
    meToo: on ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/**
 * 대화 메시지를 질문으로 등록 (강사).
 * - 원본 메시지는 대화에 그대로 남기고, 질문 게시물이 원본을 가리킨다 (sourceMessageId)
 * - 게시물 id를 메시지 id로 고정하고 트랜잭션으로 존재 여부를 확인해 두 번 눌러도 중복 생성되지 않는다
 */
export async function linkMessageAsQuestion(
  sid: string,
  message: Message & { id: string },
  admin: { uid: string; name: string },
  extra: { gridIndex: number; moduleId: string | null }
): Promise<string> {
  const db = getDb();
  const postId = `from-message-${message.id}`;
  const postRef = doc(db, "sessions", sid, "posts", postId);
  const msgRef = doc(db, "sessions", sid, "messages", message.id);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(postRef);
    if (existing.exists()) return;
    tx.set(postRef, {
      authorId: admin.uid,
      authorName: message.authorName,
      authorRole: "participant",
      originalAuthorId: message.authorId,
      originalAuthorName: message.authorName,
      sourceMessageId: message.id,
      kind: "question",
      isQuestion: true,
      questionStatus: "open",
      meToo: [],
      content: message.content,
      type: "text",
      gridIndex: extra.gridIndex,
      color: "blue",
      ...(extra.moduleId ? { moduleId: extra.moduleId } : {}),
      createdAt: serverTimestamp(),
    });
    tx.update(msgRef, { linkedPostId: postId });
  });
  return postId;
}
