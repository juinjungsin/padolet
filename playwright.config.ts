import { defineConfig, devices } from "@playwright/test";
import { EMULATOR_APP_PORT } from "./scripts/emulator-env.mjs";

// E2E 검증 — 에뮬레이터 + 에뮬레이터 연결 개발 서버를 자동으로 띄운다 (`npm run test:e2e`)
// 운영 Firebase에는 접속하지 않는다 (demo-padolet 프로젝트).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // 가상 데이터는 각 spec의 beforeAll에서 seed()로 초기화 (webServer 기동 이후 실행 보장)
  use: {
    baseURL: `http://localhost:${EMULATOR_APP_PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node scripts/emulators.mjs start",
      url: "http://127.0.0.1:8080",
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      command: "node scripts/dev-emulator.mjs",
      url: `http://localhost:${EMULATOR_APP_PORT}`,
      reuseExistingServer: true,
      timeout: 240_000,
    },
  ],
});
