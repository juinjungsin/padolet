// 로컬 Firebase 에뮬레이터(Auth·Firestore·Storage) 실행 도우미
//   node scripts/emulators.mjs start            에뮬레이터만 실행 (Ctrl+C로 종료)
//   node scripts/emulators.mjs exec "<명령>"    에뮬레이터를 띄운 상태로 명령 실행 후 종료
// Java가 PATH에 없으면 JAVA_HOME 또는 ~/tools/jdk-* 폴더를 자동으로 찾는다.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { EMULATOR_PROJECT_ID } from "./emulator-env.mjs";

const FIREBASE_TOOLS = "firebase-tools@15.34.0";

function findJavaHome() {
  const fromEnv = process.env.JAVA_HOME;
  if (fromEnv && existsSync(path.join(fromEnv, "bin"))) return fromEnv;
  const toolsDir = path.join(homedir(), "tools");
  if (!existsSync(toolsDir)) return null;
  const jdk = readdirSync(toolsDir)
    .filter((d) => d.startsWith("jdk-"))
    .sort()
    .pop();
  return jdk ? path.join(toolsDir, jdk) : null;
}

function withJava(env) {
  const javaHome = findJavaHome();
  if (!javaHome) return env;
  // Windows의 환경변수 키는 "Path"일 수 있어 대소문자 무시로 찾는다
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  return {
    ...env,
    JAVA_HOME: javaHome,
    [pathKey]: `${path.join(javaHome, "bin")}${path.delimiter}${env[pathKey] ?? ""}`,
  };
}

const [mode, ...rest] = process.argv.slice(2);
if (mode !== "start" && mode !== "exec") {
  console.error('usage: node scripts/emulators.mjs start | exec "<command>"');
  process.exit(2);
}

const sub = mode === "exec" ? `emulators:exec "${rest.join(" ").replace(/"/g, '\\"')}"` : "emulators:start";
const command = `npx --yes ${FIREBASE_TOOLS} ${sub} --only auth,firestore,storage --project ${EMULATOR_PROJECT_ID}`;

const child = spawn(command, { stdio: "inherit", env: withJava(process.env), shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
