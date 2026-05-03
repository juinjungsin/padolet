import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db as getDb } from "./firebase";

// --- 타입 정의 ---

export interface Announcement {
  content: string;
  active: boolean;
  createdAt: Timestamp;
  id: string; // 동일 내용 재공지 구분용
}

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

export function onPosts(sessionId: string, callback: (posts: Post[]) => void) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "posts"),
    orderBy("gridIndex", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));
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
