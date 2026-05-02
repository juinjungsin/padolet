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
  Timestamp,
} from "firebase/firestore";
import { db as getDb } from "./firebase";

// --- 타입 정의 ---

export interface Session {
  id?: string;
  title: string;
  description: string;
  code: string;
  createdBy: string;
  createdAt: Timestamp;
  participantCount: number;
  requireGoogleLogin: boolean;
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

export function onMessages(sessionId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message));
  });
}
