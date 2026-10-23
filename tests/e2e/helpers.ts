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

/** 교육생 입장 — 첫 시도에 보드까지 들어가야 한다 */
export async function joinAsParticipant(page: Page, code: string, name: string) {
  await page.goto(`/join?code=${code}`);
  await page.getByPlaceholder("이름을 입력하세요").fill(name);
  await page.getByRole("button", { name: "입장하기" }).click();
}
