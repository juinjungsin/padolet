import { test, expect } from "@playwright/test";
import { seed, SEED, STORAGE_ORIGIN, SUPER_ADMIN, TEACHER } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin } from "./helpers";

// P0 검증 — 참여 지표 일관성(P0-01), 보고서 첨부·내보내기(P0-02), 입장 실패 회귀
test.beforeAll(async () => {
  await seed();
});

test("교육생은 첫 시도에 오류 없이 보드에 입장한다", async ({ page }) => {
  await joinAsParticipant(page, SEED.main.code, "박검증");
  await expect(page).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
  await expect(page.getByText("입장에 실패했습니다")).toHaveCount(0);
});

test("관리자 목록·보드·참여자 패널·보고서의 누적 입장 인원이 같다", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  // 시드 4명 + 앞 테스트의 박검증 1명 = 5명 (세션 문서의 participantCount=1은 무시되어야 함)
  const row = page.getByTestId(`session-row-${SEED.main.id}`);
  await expect(row).toContainText("누적 입장 5명");

  // 관리자가 보드에 들어가면 관리자도 입장 인원에 포함 → 모든 화면이 6명
  await page.goto(`/board/${SEED.main.id}`);
  await expect(page.getByLabel("누적 입장 6명", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /참여자 보기/ }).first().click();
  await expect(page.getByTestId("metric-cumulative")).toHaveText("누적 입장 6명");

  await page.goto("/admin");
  await expect(page.getByTestId(`session-row-${SEED.main.id}`)).toContainText("누적 입장 6명");

  await page.goto(`/admin/report/${SEED.main.id}`);
  await expect(page.getByTestId("report-summary")).toContainText(/누적 입장\s*6명/);
  await expect(page.getByTestId("report-summary")).not.toContainText("누적 입장 누적 입장");
});

test("보고서 화면과 MD에 첨부 전용 게시물의 파일명·링크·시각이 포함된다", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(`/admin/report/${SEED.main.id}`);
  const posts = page.getByTestId("report-posts");
  await expect(posts).toContainText(SEED.longFileName);
  await expect(posts).toContainText("화면캡처.png");
  await expect(posts).toContainText("빈파일.txt");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "MD 다운로드" }).first().click();
  const download = await downloadPromise;
  const md = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  // 첨부 전용 게시물도 파일명 링크로 출력 (빈 항목 금지)
  expect(md).toContain(`[${SEED.longFileName}](${STORAGE_ORIGIN}/`);
  expect(md).toContain(`[화면캡처.png](${STORAGE_ORIGIN}/`);
  expect(md).toContain("보고서");
  expect(md).not.toContain("레포트");
});

test("위임 관리자는 본인이 만든 세션의 보고서를 열 수 있다", async ({ page }) => {
  await loginAsAdmin(page, TEACHER.email);
  await page.getByRole("button", { name: "새 세션 만들기" }).click();
  await page.getByLabel("세션 제목").fill("위임 관리자 세션");
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await page.getByRole("button", { name: "닫기" }).last().click();

  const row = page.getByTestId(/session-row-/).filter({ hasText: "위임 관리자 세션" });
  await row.getByRole("button", { name: "보고서" }).click();
  await expect(page.getByText("접근 권한이 없습니다")).toHaveCount(0);
  await expect(page.getByTestId("report-summary")).toBeVisible();
});

test("보드의 용량 표시와 문구가 한국어 규칙을 따른다", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(`/board/${SEED.main.id}`);
  // 데스크톱·모바일 레이아웃이 함께 렌더되므로 화면에 보이는 쪽만 검사
  const board = page.locator('[data-testid="post-board"]:visible');
  await expect(board).toContainText("빈파일.txt");
  await expect(board).not.toContainText("0.0MB");
  await expect(board).toContainText("0 B");
  await expect(board).toContainText("고정됨");
  for (const english of ["Pinned", "Copy", "Copied!"]) {
    await expect(board.getByText(english, { exact: true })).toHaveCount(0);
  }
  const chat = page.locator('[data-testid="chat-panel"]:visible');
  await expect(chat).toContainText("11.7 KB"); // 12,000 bytes
  for (const english of ["Copy", "Reply", "Hide", "Unhide", "Block", "Edit"]) {
    await expect(chat.getByText(english, { exact: true })).toHaveCount(0);
  }
});
