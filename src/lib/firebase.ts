import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithCredential,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function isConfigured(): boolean {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
}

function getApp(): FirebaseApp {
  if (!app) {
    if (!isConfigured()) {
      throw new Error("Firebase 설정이 필요합니다. .env.local 파일을 확인하세요.");
    }
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

function getDb(): Firestore {
  if (!db) db = getFirestore(getApp());
  return db;
}

function getAuthInstance(): Auth {
  if (!auth) auth = getAuth(getApp());
  return auth;
}

export { getDb as db, getAuthInstance as auth, isConfigured };

// Firestore를 직접 import하는 곳에서 사용할 수 있도록 re-export
export function getFirestoreDb(): Firestore {
  return getDb();
}

// ---------- Firebase Auth 이중 로그인 헬퍼 ----------

/**
 * NextAuth Google 로그인의 id_token으로 Firebase Auth에 이중 로그인.
 * 이미 같은 계정으로 로그인되어 있으면 no-op.
 *
 * 실패 사유
 * - id_token 만료 (Google id_token 유효기간 약 1시간) → NextAuth 재로그인 필요
 * - Firebase Console → Authentication → Sign-in method → Google 미활성 시 실패
 */
export async function signInWithGoogleCredential(idToken: string): Promise<User> {
  const a = getAuthInstance();
  // 이미 로그인 상태면 재사용 (매번 signIn하면 auth state 이벤트 폭주)
  if (a.currentUser && !a.currentUser.isAnonymous) {
    return a.currentUser;
  }
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(a, credential);
  return result.user;
}

/**
 * 참여자용 익명 로그인.
 * 브라우저 세션 동안 uid가 유지됨 (indexedDB 보관).
 * 다른 브라우저·시크릿 창에서는 새 uid 발급됨 — 정상.
 *
 * 실패 사유
 * - Firebase Console → Authentication → Sign-in method → Anonymous 미활성 시 실패
 */
export async function signInAsAnonymousUser(): Promise<User> {
  const a = getAuthInstance();
  if (a.currentUser) {
    return a.currentUser;
  }
  const result = await signInAnonymously(a);
  return result.user;
}

/**
 * Firebase Auth의 currentUser가 준비될 때까지 대기.
 * 초기 로딩 시 auth 복원이 비동기라 currentUser가 null인 순간이 있음.
 * timeoutMs 초과하면 null 반환.
 */
export function waitForAuthUser(timeoutMs = 3000): Promise<User | null> {
  const a = getAuthInstance();
  if (a.currentUser) return Promise.resolve(a.currentUser);
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      resolve(null);
    }, timeoutMs);
    const unsub = onAuthStateChanged(a, (user) => {
      if (done) return;
      if (user) {
        done = true;
        clearTimeout(timer);
        unsub();
        resolve(user);
      }
    });
  });
}
