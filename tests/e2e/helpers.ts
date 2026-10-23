import { expect, Page } from "@playwright/test";

/** 에뮬레이터 전용 NextAuth 로그인 (Google OAuth 대신 이메일 자격증명) */
export async function loginAsAdmin(page: Page, email: string) {
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  const res = await page.request.post("/api/auth/callback/emulator", {
    form: { csrfToken, email, callbackUrl: "/admin", json: "true" },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/admin");
  // NextAuth → Firebase Auth 이중 로그인이 끝나면 세션 관리 화면이 뜬다
  await expect(page.getByRole("heading", { name: "세션 관리" })).toBeVisible();
}

/** 접혀 있는 포스트잇 입력 카드를 펼친다 (이미 펼쳐져 있으면 그대로) */
export async function openComposer(page: Page) {
  const collapsed = page.getByRole("button", { name: /포스트잇 남기기/ });
  if (await collapsed.isVisible()) await collapsed.click();
  await expect(page.getByLabel("포스트잇 내용")).toBeVisible();
}

/** 교육생 입장 — 첫 시도에 보드까지 들어가야 한다 */
export async function joinAsParticipant(page: Page, code: string, name: string) {
  await page.goto(`/join?code=${code}`);
  await page.getByPlaceholder("이름을 입력하세요").fill(name);
  await page.getByRole("button", { name: "입장하기" }).click();
}
