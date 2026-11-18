import { test, expect } from "@playwright/test";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { seed, SEED, createTestEnv } from "../support/seed.mjs";
import { EMULATOR_PORTS } from "../../scripts/emulator-env.mjs";
import { joinAsParticipant } from "./helpers";
import { parseGeneratedFlow } from "../../src/lib/flowchart-ai";

test.beforeAll(async () => { await seed(); });
const key = "sk-test-placeholder-not-a-real-key";
const generated = parseGeneratedFlow({ title: "AI 견적 업무", warnings: ["승인 기한은 원문에 없습니다."],
  nodes: ["접수", "승인"].map((label, i) => ({ id: `n${i}`, label, kind: i ? "decision" : "step", organization: i ? "관리팀" : "영업팀", owner: "담당자", input: "요청서", output: "견적서", system: "ERP", issue: "", improvement: "", action: null, minutes: null, waitMinutes: null })),
  edges: [{ from: "n0", to: "n1", label: "검토", kind: "approval", deliverable: "견적서", agreement: "금액 확인" }],
});
const file = { name: "내업무.md", mimeType: "text/markdown", buffer: Buffer.from("# 내 업무\n영업팀에서 요청을 접수하고 관리팀에서 견적서를 승인합니다.") };

test("MD 업로드·미리보기·교체 확인·저장 복원 및 키 비저장", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/flowcharts/generate", async route => {
    calls++; const body = route.request().postDataJSON();
    expect(body.markdown).toContain("영업팀"); expect(body.apiKey).toBe(key);
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill({ json: generated });
  });
  await joinAsParticipant(page, SEED.main.code, "AI 작성자");
  await page.getByRole("tab", { name: "흐름도", exact: true }).click();
  await page.getByRole("button", { name: "작업 추가", exact: true }).click();
  await page.getByLabel("단계 이름", { exact: true }).fill("기존 업무");
  await page.getByRole("button", { name: "흐름도 저장", exact: true }).click();
  await expect(page.getByText("흐름도를 저장했습니다.", { exact: true })).toBeVisible();
  const panel = page.getByTestId("flow-ai-import");
  await panel.getByText("MD 파일에서 AI로 흐름도 만들기", { exact: true }).click();
  await panel.getByLabel("OpenAI API 키", { exact: true }).fill(key);
  await expect(panel.getByLabel("OpenAI API 키", { exact: true })).toHaveAttribute("type", "password");
  await panel.getByLabel("업무 설명 Markdown 파일", { exact: true }).setInputFiles(file);
  expect(calls).toBe(0);
  await panel.getByRole("button", { name: "AI로 생성", exact: true }).click();
  const preview = panel.getByRole("region", { name: "AI 생성 결과 미리보기" });
  await expect(preview).toContainText("승인 기한은 원문에 없습니다.");
  await expect(page.getByLabel("흐름도 제목", { exact: true })).toHaveValue("작업 흐름도");
  await preview.getByRole("button", { name: "단계 접수", exact: true }).click();
  await expect(preview.getByLabel("담당 조직", { exact: true })).toHaveValue("영업팀");
  page.once("dialog", d => d.dismiss());
  await preview.getByRole("button", { name: "현재 흐름도에 적용" }).click();
  await expect(preview).toBeVisible();
  await expect(page.getByRole("button", { name: "단계 기존 업무", exact: true })).toBeVisible();
  page.once("dialog", d => d.accept());
  await preview.getByRole("button", { name: "현재 흐름도에 적용" }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByLabel("흐름도 제목", { exact: true })).toHaveValue("AI 견적 업무");
  expect(calls).toBe(1);
  const persisted = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(persisted).not.toContain(key);
  await page.getByRole("button", { name: "흐름도 저장", exact: true }).click();
  await expect(page.getByText("흐름도를 저장했습니다.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "흐름도", exact: true }).click();
  await expect(page.getByRole("button", { name: "단계 승인", exact: true })).toBeVisible();
  await panel.getByText("MD 파일에서 AI로 흐름도 만들기", { exact: true }).click();
  await expect(panel.getByLabel("OpenAI API 키", { exact: true })).toHaveValue("");
  await expect(panel.getByRole("button", { name: "AI로 생성", exact: true })).toBeDisabled();
});

test("모바일 파일 검증·API 오류·취소는 기존 초안을 보존", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await joinAsParticipant(page, SEED.main.code, "AI 모바일");
  await page.getByRole("tab", { name: "흐름도", exact: true }).click();
  const panel = page.getByTestId("flow-ai-import");
  await panel.getByText("MD 파일에서 AI로 흐름도 만들기", { exact: true }).click();
  await panel.getByLabel("OpenAI API 키", { exact: true }).fill(key);
  const input = panel.getByLabel("업무 설명 Markdown 파일", { exact: true });
  await input.setInputFiles({ ...file, name: "invalid.pdf" });
  await expect(panel.getByRole("alert")).toContainText(".md 또는");
  await input.setInputFiles({ ...file, buffer: Buffer.alloc(128 * 1024 + 1, 65) });
  await expect(panel.getByRole("alert")).toContainText("128KB");
  await input.setInputFiles({ ...file, buffer: Buffer.from([0xff, 0xfe, 0x00]) });
  await expect(panel.getByRole("alert")).toContainText("UTF-8");
  await input.setInputFiles(file);
  await page.route("**/api/flowcharts/generate", route => route.fulfill({ status: 429, json: { error: "OpenAI 사용 한도·잔액을 확인해 주세요." } }));
  await panel.getByRole("button", { name: "AI로 생성", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("사용 한도");
  await expect(page.getByLabel("흐름도 제목", { exact: true })).toHaveValue("작업 흐름도");
  await page.unroute("**/api/flowcharts/generate");
  let release: () => void = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/flowcharts/generate", async route => { await waiting; await route.fulfill({ json: generated }).catch(() => {}); });
  await panel.getByRole("button", { name: "AI로 생성", exact: true }).click();
  await panel.getByRole("button", { name: "생성 취소", exact: true }).click();
  release();
  await expect(panel.getByRole("status")).toContainText("취소");
  await expect(panel.getByRole("region", { name: "AI 생성 결과 미리보기" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("실제 서버 경로에서 비참여자·잠금 보드 요청 차단 (AI 호출 없음)", async ({ request, baseURL }) => {
  const signed = await request.post(`http://127.0.0.1:${EMULATOR_PORTS.auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, { data: { returnSecureToken: true } });
  const { idToken, localId } = await signed.json();
  const call = () => request.post("/api/flowcharts/generate", { headers: { Origin: baseURL!, Authorization: `Bearer ${idToken}` }, data: { sessionId: SEED.main.id, apiKey: key, model: "gpt-4o-mini", markdown: "# 업무\n접수 후 완료" } });
  expect((await call()).status()).toBe(403);
  const env = await createTestEnv();
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "sessions", SEED.main.id, "participants", localId), { name: "AI 차단검증" });
      await updateDoc(doc(ctx.firestore(), "sessions", SEED.main.id), { locked: true });
    });
    expect((await call()).status()).toBe(403);
  } finally {
    await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), "sessions", SEED.main.id), { locked: false }));
    await env.cleanup();
  }
});
