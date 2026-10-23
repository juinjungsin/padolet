// 교육 진행 데이터 접근 — 실습 안내(P1-01), 질문 상태(P1-03), 진행·도움 요청(P1-04), 제출(P2-01), 템플릿(P2-02)
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db as getDb } from "./firebase";
import { createSession } from "./firestore";
import type { Message, Post, QuestionStatus, Session } from "./firestore";
import { planTemplateCopy, TemplateOptions } from "./template";
import { HelpRequest, memberDocId, Module, Progress, ProgressStatus } from "./practice";
import type { Submission, SubmissionFile, SubmissionVersion } from "./submission";

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

// ---------- 제출함 (submissions, P2-01) ----------

export function onMySubmission(sid: string, moduleId: string, uid: string, cb: (s: Submission | null) => void) {
  return onSnapshot(
    doc(getDb(), "sessions", sid, "submissions", memberDocId(moduleId, uid)),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Submission) : null),
    () => cb(null)
  );
}

/** 강사, 또는 그 실습에 제출한 교육생만 읽을 수 있다 (그 외에는 빈 목록) */
export function onModuleSubmissions(sid: string, moduleId: string, cb: (list: Submission[]) => void) {
  return onSnapshot(
    query(collection(getDb(), "sessions", sid, "submissions"), where("moduleId", "==", moduleId)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission)),
    () => cb([])
  );
}

/** 강사용 — 세션 전체 제출 (진행 화면·보고서) */
export function onAllSubmissions(sid: string, cb: (list: Submission[]) => void) {
  return onSnapshot(
    collection(getDb(), "sessions", sid, "submissions"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission)),
    () => cb([])
  );
}

export function onSubmissionVersions(sid: string, submissionId: string, cb: (list: SubmissionVersion[]) => void) {
  return onSnapshot(
    query(collection(getDb(), "sessions", sid, "submissions", submissionId, "versions"), orderBy("version", "desc")),
    (snap) => cb(snap.docs.map((d) => d.data() as SubmissionVersion)),
    () => cb([])
  );
}

/**
 * 제출·다시 제출 — 이력 문서와 최신 문서를 한 배치로 기록 (둘 중 하나만 저장되는 일 없음).
 * 파일 업로드는 호출 전에 모두 끝나 있어야 한다 (실패한 파일을 제출로 세지 않기 위함).
 */
export async function submitWork(
  sid: string,
  moduleId: string,
  uid: string,
  name: string,
  data: { text: string; files: SubmissionFile[] },
  currentVersion: number | null
): Promise<number> {
  const db = getDb();
  const id = memberDocId(moduleId, uid);
  const version = (currentVersion ?? 0) + 1;
  const batch = writeBatch(db);
  batch.set(doc(db, "sessions", sid, "submissions", id, "versions", String(version)), {
    version,
    text: data.text,
    files: data.files,
    submittedAt: serverTimestamp(),
  });
  batch.set(
    doc(db, "sessions", sid, "submissions", id),
    {
      ...(currentVersion === null ? { moduleId, uid } : {}),
      name,
      version,
      text: data.text,
      files: data.files,
      submittedAt: serverTimestamp(),
      feedbackStatus: "none",
    },
    { merge: true }
  );
  await batch.commit();
  return version;
}

/** 강사 피드백 — 해당 버전 이력에 기록하고 최신 문서에 피드백 상태 표시 */
export async function giveFeedback(
  sid: string,
  submission: Submission & { id: string },
  version: number,
  feedback: string,
  adminUid: string
) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, "sessions", sid, "submissions", submission.id, "versions", String(version)), {
    feedback,
    feedbackAt: serverTimestamp(),
    feedbackBy: adminUid,
  });
  batch.update(doc(db, "sessions", sid, "submissions", submission.id), {
    feedbackStatus: version === submission.version ? "reviewed" : submission.feedbackStatus,
    feedbackVersion: Math.max(version, submission.feedbackVersion ?? 0),
    feedbackAt: serverTimestamp(),
  });
  await batch.commit();
}

// ---------- 세션 템플릿 복제 (P2-02) ----------

/** 복제 창에 보여 줄 원본 구성 (모듈 수·복사될 강사 글 수) */
export async function loadTemplateSource(sid: string) {
  const db = getDb();
  const [moduleSnap, postSnap] = await Promise.all([
    getDocs(query(collection(db, "sessions", sid, "modules"), orderBy("order", "asc"))),
    getDocs(collection(db, "sessions", sid, "posts")),
  ]);
  return {
    modules: moduleSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Module),
    posts: postSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post),
  };
}

/**
 * 템플릿으로 새 세션 만들기 — 설정(금칙어·차단 이름) + 선택한 실습 안내·강사 자료.
 * 교육생 글·질문·대화·제출물·참여자·투표는 복사하지 않는다.
 */
export async function duplicateSessionFromTemplate(
  source: Session & { id: string },
  info: { title: string; eventDate: string | null; code: string },
  author: { uid: string; name: string },
  options: TemplateOptions
): Promise<string> {
  const db = getDb();
  const content = options.copyModules || options.copyInstructorPosts ? await loadTemplateSource(source.id) : null;
  const newSid = await createSession({
    title: info.title,
    description: source.description || "",
    eventDate: info.eventDate,
    code: info.code,
    createdBy: author.uid,
    requireGoogleLogin: source.requireGoogleLogin ?? false,
    bannedWords: source.bannedWords || [],
    blockedNames: source.blockedNames || [],
  });
  if (!content) return newSid;

  const plan = planTemplateCopy(
    { posts: content.posts, modules: content.modules, ownerId: source.createdBy },
    options,
    author,
    () => doc(collection(db, "sessions", newSid, "posts")).id
  );
  const batch = writeBatch(db);
  plan.modules.forEach((m) =>
    batch.set(doc(db, "sessions", newSid, "modules", m.newId), { ...m.data, updatedAt: serverTimestamp() })
  );
  plan.posts.forEach((p) =>
    batch.set(doc(db, "sessions", newSid, "posts", p.newId), {
      ...p.data,
      createdAt: serverTimestamp(),
      ...(p.data.pinned ? { pinnedAt: serverTimestamp() } : {}),
    })
  );
  await batch.commit();
  return newSid;
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
