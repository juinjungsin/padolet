import { defineConfig } from "vitest/config";
import path from "node:path";

// 단위 테스트(tests/unit) — 에뮬레이터 불필요, `npm test`
// 규칙 테스트(tests/rules) — 에뮬레이터 필요, `npm run test:rules`
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/rules/**/*.test.ts"],
    environment: "node",
    // 규칙 테스트는 같은 에뮬레이터를 공유하므로 파일 단위 순차 실행
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
