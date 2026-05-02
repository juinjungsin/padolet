import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

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
