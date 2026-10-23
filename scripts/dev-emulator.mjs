// 에뮬레이터에 연결된 Next 개발 서버 실행 (http://localhost:3100)
// 먼저 다른 터미널에서 `npm run emulators`, 필요하면 `npm run seed`로 가상 데이터를 넣는다.
import { spawn } from "node:child_process";
import { EMULATOR_APP_ENV, EMULATOR_APP_PORT } from "./emulator-env.mjs";

const child = spawn(`npx next dev -p ${EMULATOR_APP_PORT}`, {
  stdio: "inherit",
  env: { ...process.env, ...EMULATOR_APP_ENV },
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
