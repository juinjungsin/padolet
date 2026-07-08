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
  arrayUnion,
  arrayRemove,
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

// 세션 동기화 타이머 — admin이 시작하면 모든 참여자/프로젝터에 동일하게 표시
export interface SessionTimer {
  running: boolean;
  endsAt: Timestamp | null;
  durationMin: number;
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
  status?: SessionStatus; // 미설정 = 'active'로 간주
  endedAt?: Timestamp | null;
  timer?: SessionTimer | null;
  /** 프로젝터에 확대 표시할 포스트 ID (스포트라이트) */
  spotlightPostId?: string | null;
  /** 보드 잠금 — true면 참여자는 열람만 가능 (작성/대화/리액션 차단) */
  locked?: boolean;
}

export interface Participant {
  id?: string;
  name: string;
  isAnonymous: boolean;
  joinedAt: Timestamp;
  isOnline: boolean;
  lastSeenAt: Timestamp;
}

// 포스트잇 색상 태그 (그룹핑용)
export const POST_COLORS = ["yellow", "blue", "green", "pink"] as const;
export type PostColor = (typeof POST_COLORS)[number];

// 리액션 종류 — Firestore 필드 키는 영문(key), 표시용은 emoji
export const REACTIONS = [
  { key: "up", emoji: "👍" },
  { key: "heart", emoji: "❤️" },
  { key: "clap", emoji: "👏" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionMap = Partial<Record<ReactionKey, string[]>>;

export function reactionTotal(reactions: ReactionMap | undefined): number {
  if (!reactions) return 0;
  return REACTIONS.reduce((sum, r) => sum + (reactions[r.key]?.length || 0), 0);
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
  /** 리액션 — { up: [uid, ...], heart: [...], clap: [...] } */
  reactions?: ReactionMap;
  /** 질문 여부 (Q&A 모드) */
  isQuestion?: boolean;
  /** 색상 태그 (미설정 = yellow) */
  color?: PostColor;
  /** 댓글 수 (비정규화 — 접힌 상태에서도 표시하기 위함) */
  commentCount?: number;
}

// 포스트잇 댓글 — posts/{postId}/comments 서브컬렉션
export interface Comment {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp;
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

/**
 * 참여자 등록.
 * - 문서 ID는 Firebase Auth UID로 고정 → Firestore Rules에서 참여 여부 검증에 사용.
 * - 이미 존재하는 uid로 재입장 시 participantCount 중복 증가 방지 (isNew 판별).
 * - setDoc merge: true 로 name/isAnonymous 등 최신값 반영, joinedAt은 최초 1회만 기록.
 */
export async function addParticipant(
  sessionId: string,
  uid: string,
  data: Omit<Participant, "id" | "joinedAt" | "lastSeenAt">
) {
  const participantRef = doc(getDb(), "sessions", sessionId, "participants", uid);
  const existing = await getDoc(participantRef);
  const isNew = !existing.exists();

  const payload: Record<string, unknown> = {
    ...data,
    lastSeenAt: serverTimestamp(),
  };
  if (isNew) {
    payload.joinedAt = serverTimestamp();
  }

  await setDoc(participantRef, payload, { merge: true });

  if (isNew) {
    await updateDoc(doc(getDb(), "sessions", sessionId), {
      participantCount: increment(1),
    });
  }
  return uid;
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

/**
 * 리액션 토글.
 * - arrayUnion/arrayRemove로 원자적 갱신 → 동시 클릭 race 없음
 * - Firestore Rules에서 참여자는 reactions 필드만 수정 가능하도록 제한
 */
export async function toggleReaction(
  sessionId: string,
  postId: string,
  key: ReactionKey,
  userId: string,
  active: boolean
) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "posts", postId), {
    [`reactions.${key}`]: active ? arrayUnion(userId) : arrayRemove(userId),
  });
}

export async function setPostColor(sessionId: string, postId: string, color: PostColor) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "posts", postId), { color });
}

export async function editPost(sessionId: string, postId: string, content: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "posts", postId), {
    content,
    editedAt: Timestamp.now(),
  });
}

// --- 포스트잇 댓글 ---

/**
 * 댓글 작성.
 * - 댓글 문서 생성 + 상위 포스트의 commentCount 증가를 writeBatch로 원자 처리.
 * - Firestore Rules에서 참여자는 commentCount만 변경 가능하도록 제한.
 */
export async function addComment(
  sessionId: string,
  postId: string,
  data: Omit<Comment, "id" | "createdAt">
) {
  const db = getDb();
  const commentRef = doc(collection(db, "sessions", sessionId, "posts", postId, "comments"));
  const postRef = doc(db, "sessions", sessionId, "posts", postId);
  const batch = writeBatch(db);
  batch.set(commentRef, { ...data, createdAt: serverTimestamp() });
  batch.update(postRef, { commentCount: increment(1) });
  await batch.commit();
  return commentRef.id;
}

export async function deleteComment(sessionId: string, postId: string, commentId: string) {
  const db = getDb();
  const commentRef = doc(db, "sessions", sessionId, "posts", postId, "comments", commentId);
  const postRef = doc(db, "sessions", sessionId, "posts", postId);
  const batch = writeBatch(db);
  batch.delete(commentRef);
  batch.update(postRef, { commentCount: increment(-1) });
  await batch.commit();
}

export function onComments(
  sessionId: string,
  postId: string,
  callback: (comments: Comment[]) => void
) {
  const q = query(
    collection(getDb(), "sessions", sessionId, "posts", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Comment));
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

// --- 세션 타이머 (동기화) ---

export async function startSessionTimer(sessionId: string, minutes: number) {
  await updateDoc(doc(getDb(), "sessions", sessionId), {
    timer: {
      running: true,
      durationMin: minutes,
      endsAt: Timestamp.fromMillis(Date.now() + minutes * 60_000),
    },
  });
}

export async function stopSessionTimer(sessionId: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId), { timer: null });
}

// --- 스포트라이트 (프로젝터 확대 표시) ---

export async function setSpotlightPost(sessionId: string, postId: string | null) {
  await updateDoc(doc(getDb(), "sessions", sessionId), { spotlightPostId: postId });
}

// --- 보드 잠금 ---

/**
 * 보드 전체 잠금 토글 (admin 전용).
 * 잠금 중에는 참여자의 포스트잇 작성/편집/삭제, 대화, 리액션이 차단되어
 * 공지 등 현재 보드 내용을 그대로 유지·열람시킬 수 있다.
 * Firestore Rules에서도 동일 조건을 강제하므로 UI 우회 불가.
 */
export async function setBoardLocked(sessionId: string, locked: boolean) {
  await updateDoc(doc(getDb(), "sessions", sessionId), { locked });
}

// --- 참여자 presence ---

// heartbeat 주기(초). Firestore 쓰기 비용이 참여자 수에 비례하므로 보수적으로 설정.
export const HEARTBEAT_SECONDS = 60;
// 마지막 heartbeat 이후 이 시간(ms) 이내면 온라인으로 간주 (주기의 2.5배)
export const ONLINE_THRESHOLD_MS = HEARTBEAT_SECONDS * 2500;

export async function touchParticipant(sessionId: string, uid: string) {
  await updateDoc(doc(getDb(), "sessions", sessionId, "participants", uid), {
    lastSeenAt: serverTimestamp(),
    isOnline: true,
  });
}

export function isParticipantOnline(p: Participant, now: number = Date.now()): boolean {
  if (!p.lastSeenAt?.toDate) return false;
  return now - p.lastSeenAt.toDate().getTime() < ONLINE_THRESHOLD_MS;
}

// --- 퀴즈 리더보드 ---

export interface LeaderboardEntry {
  voterId: string;
  name: string;
  correct: number;
  answered: number;
}

/**
 * 세션 내 모든 퀴즈(correctIndex 설정)의 정답 수를 참여자별로 집계.
 * 익명 투표(anonymous)는 이름 공개 약속을 지키기 위해 집계에서 제외.
 */
export async function getQuizLeaderboard(
  sessionId: string
): Promise<{ entries: LeaderboardEntry[]; quizCount: number }> {
  const pollsSnap = await getDocs(collection(getDb(), "sessions", sessionId, "polls"));
  const quizzes = pollsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Poll)
    .filter((p) => p.correctIndex !== null && p.correctIndex !== undefined && !p.anonymous);

  const map = new Map<string, LeaderboardEntry>();
  for (const quiz of quizzes) {
    const votesSnap = await getDocs(
      collection(getDb(), "sessions", sessionId, "polls", quiz.id!, "votes")
    );
    votesSnap.docs.forEach((v) => {
      const vote = v.data() as PollVote;
      const entry = map.get(vote.voterId) || {
        voterId: vote.voterId,
        name: vote.voterName,
        correct: 0,
        answered: 0,
      };
      entry.answered += 1;
      entry.name = vote.voterName;
      if (vote.optionIndex === quiz.correctIndex) entry.correct += 1;
      map.set(vote.voterId, entry);
    });
  }

  const entries = Array.from(map.values()).sort(
    (a, b) => b.correct - a.correct || a.answered - b.answered
  );
  return { entries, quizCount: quizzes.length };
}

// --- 세션 복제 ---

/**
 * 기존 세션의 설정(제목/설명/금칙어/차단 이름/로그인 요구)을 복사해 새 세션 생성.
 * 포스트잇/대화/참여자는 복사하지 않음.
 */
export async function duplicateSession(
  source: Session & { id: string },
  newCode: string,
  createdBy: string
): Promise<string> {
  return createSession({
    title: `${source.title} (복사)`,
    description: source.description || "",
    code: newCode,
    createdBy,
    requireGoogleLogin: source.requireGoogleLogin ?? false,
    bannedWords: source.bannedWords || [],
    blockedNames: source.blockedNames || [],
  });
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
