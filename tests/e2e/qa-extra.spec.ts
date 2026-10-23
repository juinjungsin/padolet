import { test, expect } from "@playwright/test";
import { seed, SEED, TEACHER } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin, openComposer } from "./helpers";

// 남은 검증 시나리오 — QA-02(역할별 범위), QA-08(업로드 실패·재시도), QA-11(쉬는시간·프로젝터), QA-13(연결 끊김)
test.beforeAll(async () => {
  await seed();
});

test("QA-08 — 일부 파일 업로드 실패: 실패만 알리고, 실패한 파일만 다시 올려 중복 게시가 없다", async ({ page }) => {
  await joinAsParticipant(page, SEED.main.code, "업로드검증");
  await expect(page).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));

  // 두 번째 파일의 Storage 업로드만 거부 (재시도해도 소용없는 403 → 즉시 실패)
  await page.route("**/v0/b/**", (route) => {
    const req = route.request();
    if (req.method() !== "GET" && req.url().includes("second.txt")) {
      return route.fulfill({ status: 403, contentType: "application/json", body: '{"error":{"code":403,"message":"denied"}}' });
    }
    return route.continue();
  });

  await openComposer(page);
  await page.locator('form input[type="file"]').first().setInputFiles([
    { name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("first") },
    { name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("second") },
  ]);
  const board = page.locator('[data-testid="post-board"]:visible');
  await expect(page.getByRole("alert").filter({ hasText: "second.txt 업로드에 실패했습니다." })).toBeVisible();
  await expect(board.locator("div.group", { hasText: "first.txt" })).toHaveCount(1);
  await expect(board.locator("div.group", { hasText: "second.txt" })).toHaveCount(0); // 허위 성공 없음

  await page.unroute("**/v0/b/**");
  await page.getByRole("button", { name: "실패한 파일 다시 시도" }).click();
  await expect(board.locator("div.group", { hasText: "second.txt" })).toHaveCount(1);
  await expect(board.locator("div.group", { hasText: "first.txt" })).toHaveCount(1); // 중복 게시 없음
  await expect(page.getByRole("button", { name: "실패한 파일 다시 시도" })).toHaveCount(0);
});

test("QA-13 — 연결이 끊기면 안내하고, 다시 연결되면 사라진다", async ({ page, context }) => {
  await joinAsParticipant(page, SEED.main.code, "연결검증");
  await expect(page).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "인터넷 연결이 끊겼습니다." })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("인터넷 연결이 끊겼습니다.")).toHaveCount(0);
  // 복구 후에도 보드가 계속 동작
  await expect(page.locator('[data-testid="post-board"]:visible')).toContainText("첫 번째 가상 포스트잇입니다.");
});

test("QA-11 — 쉬는시간 타이머와 프로젝터 화면이 열린다", async ({ page }) => {
  await joinAsParticipant(page, SEED.main.code, "기능검증");
  await page.getByRole("link", { name: "쉬는시간 타이머" }).click();
  await expect(page.getByRole("heading", { name: "잠시 숨 고르고 돌아오세요" })).toBeVisible();

  await page.goto(`/board/${SEED.main.id}/projector`);
  await expect(page.getByText(SEED.main.title).first()).toBeVisible();
  await expect(page.getByAltText(/QR/).first()).toBeVisible();
  // 파일 전용 게시물도 빈 카드가 아니라 파일명이 보인다
  await expect(page.getByText(SEED.longFileName).first()).toBeVisible();
});

test("QA-02 — 위임 관리자는 자기 세션만 보고, 다른 세션 보고서는 열 수 없다", async ({ page }) => {
  await loginAsAdmin(page, TEACHER.email);
  await expect(page.getByText("아직 만든 세션이 없습니다.", { exact: false })).toBeVisible();
  await expect(page.getByTestId(`session-row-${SEED.main.id}`)).toHaveCount(0);
  await page.goto(`/admin/report/${SEED.main.id}`);
  await expect(page.getByText("접근 권한이 없습니다")).toBeVisible();
});
