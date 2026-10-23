import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, uploadBytes } from "firebase/storage";
import { createTestEnv } from "../support/seed.mjs";

// Storage 업로드 규칙 — 인증 필수, 파일 1개 100MB까지 (2026-10 50MB에서 상향)
let env: RulesTestEnvironment;
const MB = 1024 * 1024;
const path = (name: string) => `padolet/storage-session/${name}`;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});

const learner = () => env.authenticatedContext("learner", { firebase: { sign_in_provider: "anonymous" } }).storage();
const upload = (storage: ReturnType<typeof learner>, name: string, size: number, contentType = "video/mp4") =>
  uploadBytes(ref(storage, path(name)), new Uint8Array(size), { contentType });

describe("첨부 파일 크기", () => {
  it("예전 상한(50MB)을 넘는 60MB 파일을 올릴 수 있다", async () => {
    await assertSucceeds(upload(learner(), "60mb.mp4", 60 * MB));
  }, 120_000);

  it("정확히 100MB까지 올릴 수 있다", async () => {
    await assertSucceeds(upload(learner(), "100mb.mp4", 100 * MB));
  }, 120_000);

  it("100MB를 넘으면 거절된다", async () => {
    await assertFails(upload(learner(), "over.mp4", 100 * MB + 1));
  }, 120_000);

  it("로그인하지 않으면 작은 파일도 올릴 수 없다", async () => {
    await assertFails(upload(env.unauthenticatedContext().storage(), "anon.txt", 10, "text/plain"));
  });
});
