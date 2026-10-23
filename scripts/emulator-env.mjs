// 로컬 에뮬레이터 모드에서 Next 앱에 주입하는 환경변수 (운영 .env.local 값을 덮어씀)
// demo- 접두사 프로젝트는 Firebase가 실제 리소스에 절대 연결하지 않는 전용 ID.
//
// PADOLET_EMULATOR_OFFSET=1000 처럼 지정하면 모든 포트를 그만큼 옮겨
// 확인용 서버(기본 포트)와 테스트 실행을 동시에 띄울 수 있다.
export const EMULATOR_PROJECT_ID = "demo-padolet";

const OFFSET = Number(process.env.PADOLET_EMULATOR_OFFSET || 0);

export const EMULATOR_PORTS = {
  auth: 9099 + OFFSET,
  firestore: 8080 + OFFSET,
  storage: 9199 + OFFSET,
  hub: 4400 + OFFSET,
  logging: 4500 + OFFSET,
  firestoreWebsocket: 9150 + OFFSET,
};
export const EMULATOR_APP_PORT = 3100 + OFFSET;
export const EMULATOR_OFFSET = OFFSET;

export const EMULATOR_APP_ENV = {
  NEXT_PUBLIC_USE_EMULATOR: "1",
  NEXT_PUBLIC_EMULATOR_AUTH_PORT: String(EMULATOR_PORTS.auth),
  NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT: String(EMULATOR_PORTS.firestore),
  NEXT_PUBLIC_EMULATOR_STORAGE_PORT: String(EMULATOR_PORTS.storage),
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${EMULATOR_PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
  NEXTAUTH_URL: `http://localhost:${EMULATOR_APP_PORT}`,
  NEXTAUTH_SECRET: "emulator-only-secret",
};
