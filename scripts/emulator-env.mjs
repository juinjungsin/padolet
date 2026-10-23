// 로컬 에뮬레이터 모드에서 Next 앱에 주입하는 환경변수 (운영 .env.local 값을 덮어씀)
// demo- 접두사 프로젝트는 Firebase가 실제 리소스에 절대 연결하지 않는 전용 ID.
export const EMULATOR_PROJECT_ID = "demo-padolet";
export const EMULATOR_APP_PORT = 3100;

export const EMULATOR_APP_ENV = {
  NEXT_PUBLIC_USE_EMULATOR: "1",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${EMULATOR_PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
  NEXTAUTH_URL: `http://localhost:${EMULATOR_APP_PORT}`,
  NEXTAUTH_SECRET: "emulator-only-secret",
};
