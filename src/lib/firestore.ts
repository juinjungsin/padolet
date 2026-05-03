import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp,
  QueryDocumentSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db as getDb } from "./firebase";

// --- 권한 (Roles) ---

export const SUPER_ADMIN_EMAIL = "jongbin@gmail.com";

export interface AdminEntry {
  email: string; // 도큐먼트 ID와 동일
  addedAt: Timestamp;
  addedBy: string; // super_admin email
}

export type Role = "super" | "admin" | "none";

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export async function isDelegatedAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const snap = await getDoc(doc(getDb(), "admins", email.toLowerCase()));
  return snap.exists();
}

export async function getRole(email: string | null | undefined): Promise<Role> {
  if (!email) return "none";
  if (isSuperAdmin(email)) return "super";
  if (await isDelegatedAdmin(email)) return "admin";
  return "none";
}

export async function listAdmins(): Promise<AdminEntry[]> {
  const snap = await getDocs(collection(getDb(), "admins"));
  return snap.docs.map((d) => ({ email: d.id, ...d.data() }) as AdminEntry);
}

export async function addAdmin(email: string, addedBy: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  if (isSuperAdmin(normalized)) return; // super는 별도 등록 불필요
  await setDoc(doc(getDb(), "admins", normalized), {
    email: normalized,
    addedAt: Timestamp.now(),
    addedBy,
  });
}

export async function removeAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await deleteDoc(doc(getDb(), "admins", normalized));
}

// --- 타입 정의 ---

export interface Announcement {
  content: string;
  active: boolean;
  createdAt: Timestamp;
  id: string; // 동일 내용 재공지 구분용
}

export type SessionStatus = "active" | "ended" | "archived";

export interface Session {
  id?: string;
  title: string;
  description: string;
  code: string;
  createdBy: string;
  createdAt: Timestamp;
  participantCount: number;
  requireGoogleLogin: boolean;
  bannedWords?: string[];
  blockedNames?: string[];
  announcement?: Announcement | null;
  status?: SessionStatus; // 미설정 = 'active'로 간주
  endedAt?: Timestamp | null;
}

export interface Participant {
  id?: string;
  name: string;
  isAnonymous: boolean;
  joinedAt: Timestamp;
  isOnline: boolean;
  lastSeenAt: Timestamp;
}

export interface Post {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  type: "text" | "link" | "image" | "file";
  fileUrl?: string;
  fileMeta?: { name: string; size: number; mimeType: string };
  createdAt: Timestamp;
  gridIndex: number;
  pinned?: boolean;
  pinnedAt?: Timestamp | null;
  editedAt?: Timestamp | null;
}

export interface Message {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  type: "text" | "file" | "image";
  fileUrl?: string;
  fileMeta?: { name: string; size: number; mimeType: string };
  createdAt: Timestamp;
  hidden?: boolean;
  editedAt?: Timestamp | null;
}

// --- 세션 ---

export async function createSession(data: Omit<Session, "id" | "createdAt" | "participantCount">) {
  const ref = await addDoc(collection(getDb(), "sessions"), {
    ...data,
    createdAt: serverTimestamp(),
    participantCount: 0,
  });
  return ref.id;
}

export async function getSessionByCode(code: string): Promise<(Session & { id: string }) | null> {
  const q = query(collection(getDb(), "sessions"), where("code", "==", code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as Session & { id: string };
}

export async function getSession(sessionId: string): Promise<(Session & { id: string }) | null> {
  const docSnap = await getDoc(doc(getDb(), "sessions", sessionId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Session & { id: string };
}

export async function getSessionsByAdmin(adminId: string) {
  const q = query(
    collection(getDb(), "sessions"),
    where("createdBy", "==", adminId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Session & { id: string });
}

// super_admin 전용 — 모든 세션 조회
export async function getAllSessions() {
  const q = query(collection(getDb(), "sessions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Session & { id: string });
}

export async function updateSession(sessionId: string, data: Partial<Session>) {
  await updateDoc(doc(getDb(), "sessions", sessionId), data);
}

// 세션 + 하위 컬렉션(participants/posts/messages) 일괄 삭제
export async function deleteSession(sessionId: string) {
  const db = getDb();
  const subcollections = ["participants", "posts", "messages"];

  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, "sessions", sessionId, sub));
    // Firestore writeBatch는 최대 500 ops — 안전하게 400씩 분할
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await deleteDoc(doc(db, "sessions", sessionId));
}

export function onSession(
  sessionId: string,
  callback: (session: (Session & { id: string }) | null) => void
) {
  return onSnapshot(doc(getDb(), "sessions", sessionId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...snap.data() } as Session & { id: string });
  });
}

// --- 투표 / 퀴즈 ---

export interface Poll {
  id?: string;
  question: string;
  options: string[]; // 최대 6개 권장
  /** 정답 인덱스 (퀴즈 모드일 때 설정). null이면 단순 투표 */
  correctIndex?: number | null;
  /** 익명 투표 여부 */
  anonymous: boolean;
  /** 활성 / 종료 */
  active: boolean;
  createdAt: Timestamp;
  endedAt?: Timestamp | null;
  createdBy: string;
}

export interface PollVote {
  id?: string; // = voterId
  voterId: string;
  voterName: string;
  optionIndex: number;
  createdAt: Timestamp;
}

export async function createPoll(
  sessionId: string,
  data: Omit<Poll, "id" | "createdAt" | "active" | "endedAt">
): Promise<string> {
  const ref = await addDoc(collection(getDb(), "sessions", sessionId, "polls"), {
    ...data,
    active: true,
    endedAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function endPoll(sessionId: string, pollId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "polls", pollId), {
    active: false,
    endedAt: Timestamp.now(),
  });
}

export async function deletePoll(sessionId: string, pollId: string) {
  // votes subcollection batch delete
  const votesSnap = await getDocs(
    collection(getDb(), "sessions", sessionId, "polls", pollId, "votes")
  );
  const batch = writeBatch(getDb());
  votesSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  await deleteDoc(doc(getDb(), "sessions", sessionId, "polls", pollId));
}

export function onPolls(sessionId: string, callback: (polls: Poll[]) => void) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "polls"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Poll));
  });
}

export async function castVote(
  sessionId: string,
  pollId: string,
  voterId: string,
  voterName: string,
  optionIndex: number
) {
  // voterId를 docId로 사용 → 1인 1표 보장
  await setDoc(doc(getDb(), "sessions", sessionId, "polls", pollId, "votes", voterId), {
    voterId,
    voterName,
    optionIndex,
    createdAt: Timestamp.now(),
  });
}

export function onPollVotes(
  sessionId: string,
  pollId: string,
  callback: (votes: PollVote[]) => void
) {
  return onSnapshot(
    collection(getDb(), "sessions", sessionId, "polls", pollId, "votes"),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PollVote));
    }
  );
}

// --- 모더레이션: 금칙어 ---

export async function addBannedWord(sessionId: string, word: string) {
  const trimmed = word.trim().toLowerCase();
  if (!trimmed) return;
  const session = await getSession(sessionId);
  const current = session?.bannedWords || [];
  if (current.includes(trimmed)) return;
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    bannedWords: [...current, trimmed],
  });
}

export async function removeBannedWord(sessionId: string, word: string) {
  const session = await getSession(sessionId);
  const current = session?.bannedWords || [];
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    bannedWords: current.filter((w) => w !== word),
  });
}

export function containsBannedWord(text: string, bannedWords: string[] = []): string | null {
  if (!text || bannedWords.length === 0) return null;
  const lower = text.toLowerCase();
  for (const w of bannedWords) {
    if (lower.includes(w)) return w;
  }
  return null;
}

// --- 모더레이션: 사용자 차단 (이름 기준) ---

export async function blockUserName(sessionId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const session = await getSession(sessionId);
  const current = session?.blockedNames || [];
  if (current.includes(trimmed)) return;
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    blockedNames: [...current, trimmed],
  });
}

export async function unblockUserName(sessionId: string, name: string) {
  const session = await getSession(sessionId);
  const current = session?.blockedNames || [];
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    blockedNames: current.filter((n) => n !== name),
  });
}

export function isNameBlocked(name: string, blockedNames: string[] = []): boolean {
  return blockedNames.includes(name);
}

// --- 공지 ---

export async function publishAnnouncement(sessionId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    announcement: {
      content: trimmed,
      active: true,
      createdAt: Timestamp.now(),
      id: `ann_${Date.now()}`,
    },
  });
}

export async function dismissAnnouncement(sessionId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    "announcement.active": false,
  });
}

// --- 참여자 ---

export async function addParticipant(sessionId: string, data: Omit<Participant, "id" | "joinedAt" | "lastSeenAt">) {
  const ref = await addDoc(collection(getDb(), "sessions", sessionId, "participants"), {
    ...data,
    joinedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  });
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    participantCount: increment(1),
  });
  return ref.id;
}

export function onParticipants(sessionId: string, callback: (participants: Participant[]) => void) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "participants"),
    orderBy("joinedAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participant));
  });
}

// --- 포스트잇 ---

export async function addPost(sessionId: string, data: Omit<Post, "id" | "createdAt">) {
  const ref = await addDoc(collection(getDb(), "sessions", sessionId, "posts"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePost(sessionId: string, postId: string, data: Partial<Post>) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "posts", postId), data);
}

export async function deletePost(sessionId: string, postId: string) {
  await deleteDoc(doc(getDb(), "sessions", sessionId, "posts", postId));
}

export async function pinPost(sessionId: string, postId: string, pinned: boolean) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "posts", postId), {
    pinned,
    pinnedAt: pinned ? Timestamp.now() : null,
  });
}

export async function editPost(sessionId: string, postId: string, content: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "posts", postId), {
    content,
    editedAt: Timestamp.now(),
  });
}

export async function editMessage(sessionId: string, messageId: string, content: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "messages", messageId), {
    content,
    editedAt: Timestamp.now(),
  });
}

// 본인 작성물 편집 가능 시간 (분)
export const EDIT_WINDOW_MINUTES = 5;

export function canEditWindow(createdAt: Timestamp | undefined): boolean {
  if (!createdAt?.toDate) return false;
  const ms = Date.now() - createdAt.toDate().getTime();
  return ms < EDIT_WINDOW_MINUTES * 60 * 1000;
}

// --- 세션 라이프사이클 ---

export async function endSession(sessionId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    status: "ended",
    endedAt: Timestamp.now(),
  });
}

export async function reopenSession(sessionId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    status: "active",
    endedAt: null,
  });
}

export async function archiveSession(sessionId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    status: "archived",
  });
}

export function getSessionStatus(s: Session): SessionStatus {
  return s.status || "active";
}

export function onPosts(sessionId: string, callback: (posts: Post[]) => void) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "posts"),
    orderBy("gridIndex", "asc")
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
    // 클라이언트 정렬: 핀이 위, 그 다음 gridIndex
    list.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return a.gridIndex - b.gridIndex;
    });
    callback(list);
  });
}

// --- 대화 ---

export async function addMessage(sessionId: string, data: Omit<Message, "id" | "createdAt">) {
  const ref = await addDoc(collection(getDb(), "sessions", sessionId, "messages"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function hideMessage(sessionId: string, messageId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "messages", messageId), {
    hidden: true,
  });
}

export async function unhideMessage(sessionId: string, messageId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "messages", messageId), {
    hidden: false,
  });
}

export function onMessages(sessionId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message));
  });
}

/**
 * 메시지 페이지네이션 구독.
 * - 최신 N개를 createdAt desc로 가져온 뒤 화면 표시 시 오름차순으로 reverse
 * - loadMore() 호출 시 더 오래된 N개를 추가 페이지로 가져옴
 * - 새 메시지(real-time)는 별도 onSnapshot으로 처리 (latestQuery)
 */
export const MESSAGES_PAGE_SIZE = 50;

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
  loadMore: () => Promise<void>;
  unsubscribe: () => void;
}

export function subscribeMessagesPaginated(
  sessionId: string,
  pageSize: number,
  callback: (state: { messages: Message[]; hasMore: boolean }) => void
): { loadMore: () => Promise<void>; unsubscribe: () => void } {
  const col = collection(getDb(), "sessions", sessionId, "messages");

  // 모든 페이지를 단일 Map에 누적. 각 페이지 범위 + 라이브 구독으로 update/delete까지 동기화.
  const docMap = new Map<string, Message>();
  let oldestCursor: QueryDocumentSnapshot<DocumentData> | null = null;
  let hasMore = true;
  const unsubs: Array<() => void> = [];

  function emit() {
    const merged = Array.from(docMap.values()).sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0;
      const bt = b.createdAt?.toMillis?.() || 0;
      return at - bt;
    });
    callback({ messages: merged, hasMore });
  }

  function applySnap(snap: QuerySnapshot<DocumentData>) {
    snap.docChanges().forEach((change) => {
      if (change.type === "removed") {
        docMap.delete(change.doc.id);
      } else {
        docMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as Message);
      }
    });
    emit();
  }

  // 1단계: 최신 pageSize 1회 조회 → 범위(oldest/newest 시각) 확정 + 커서 저장
  const initialQuery = query(col, orderBy("createdAt", "desc"), limit(pageSize));
  getDocs(initialQuery)
    .then((snap) => {
      if (snap.empty) {
        hasMore = false;
        emit();
        // 비어 있어도 새 메시지 받을 수 있게 라이브 구독은 등록
        const liveU = onSnapshot(query(col, orderBy("createdAt", "asc")), applySnap);
        unsubs.push(liveU);
        return;
      }

      const oldestDoc = snap.docs[snap.docs.length - 1];
      const newestDoc = snap.docs[0];
      const oldestTs = oldestDoc.data().createdAt;
      const newestTs = newestDoc.data().createdAt;
      oldestCursor = oldestDoc;
      hasMore = snap.docs.length === pageSize;

      // 초기 페이지 범위를 onSnapshot으로 묶어 update/delete(예: hide/edit) 동기화
      const initialPageU = onSnapshot(
        query(
          col,
          orderBy("createdAt", "asc"),
          where("createdAt", ">=", oldestTs),
          where("createdAt", "<=", newestTs)
        ),
        applySnap
      );
      unsubs.push(initialPageU);

      // 새 메시지 (newestTs 이후)
      const liveU = onSnapshot(
        query(col, orderBy("createdAt", "asc"), where("createdAt", ">", newestTs)),
        applySnap
      );
      unsubs.push(liveU);
    })
    .catch(() => {
      // 조회 실패 시 fallback — 전체 라이브 구독 (안전망)
      const fallback = onSnapshot(query(col, orderBy("createdAt", "asc")), applySnap);
      unsubs.push(fallback);
    });

  async function loadMore() {
    if (!hasMore || !oldestCursor) return;
    const olderQuery = query(
      col,
      orderBy("createdAt", "desc"),
      startAfter(oldestCursor),
      limit(pageSize)
    );
    const snap = await getDocs(olderQuery);
    if (snap.empty) {
      hasMore = false;
      emit();
      return;
    }
    const oldestDoc = snap.docs[snap.docs.length - 1];
    const newestDoc = snap.docs[0];
    const olderOldestTs = oldestDoc.data().createdAt;
    const olderNewestTs = newestDoc.data().createdAt;
    oldestCursor = oldestDoc;
    hasMore = snap.docs.length === pageSize;

    // 추가 페이지 범위도 onSnapshot으로 — update/delete 추적
    const olderU = onSnapshot(
      query(
        col,
        orderBy("createdAt", "asc"),
        where("createdAt", ">=", olderOldestTs),
        where("createdAt", "<=", olderNewestTs)
      ),
      applySnap
    );
    unsubs.push(olderU);
  }

  return {
    loadMore,
    unsubscribe: () => {
      unsubs.forEach((u) => u());
      unsubs.length = 0;
      docMap.clear();
    },
  };
}
