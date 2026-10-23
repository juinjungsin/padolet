import { test, expect } from "@playwright/test";
import { collection, getDocs } from "firebase/firestore";
import { createTestEnv, seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { loginAsAdmin } from "./helpers";

test.beforeAll(async () => {
  await seed();
});

test("보고서 PDF 출력 — 액션 버튼은 숨기고 첨부·본문은 포함 (QA-10)", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(`/admin/report/${SEED.main.id}`);
  await expect(page.getByTestId("report-posts")).toContainText(SEED.longFileName);

  // 화면에서는 위·아래 액션바 2곳, 인쇄 모드에서는 모두 숨김(접근성 트리에서도 빠짐)
  await expect(page.getByRole("button", { name: "MD 다운로드" })).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "MD 다운로드" })).toHaveCount(0);
  await expect(page.getByText("첨부 다운로드 링크 포함")).toBeHidden();
  await expect(page.getByTestId("report-posts")).toBeVisible();
  // 실제 출력물은 test-results 폴더에 남겨 눈으로 확인한다
  await page.pdf({ path: test.info().outputPath("report.pdf"), format: "A4", printBackground: true });
});

test("세션 삭제 시 댓글·투표 응답까지 함께 삭제된다", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  const row = page.getByTestId(`session-row-${SEED.main.id}`);
  await row.getByRole("button", { name: /더보기/ }).click();
  await page.getByRole("menuitem", { name: "삭제…" }).click();
  // 삭제 확인 창은 복구 가능한 '보관'을 함께 안내한다
  await expect(page.getByRole("dialog")).toContainText("삭제 대신 보관");
  await page.getByRole("button", { name: "영구 삭제" }).click();
  await expect(row).toHaveCount(0);

  const env = await createTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const base = ["sessions", SEED.main.id] as const;
    for (const path of [
      [...base, "posts"],
      [...base, "messages"],
      [...base, "participants"],
      [...base, "polls"],
      [...base, "posts", "post-question", "comments"],
      [...base, "polls", "poll1", "votes"],
    ]) {
      const snap = await getDocs(collection(db, path.join("/")));
      expect(snap.size, path.join("/")).toBe(0);
    }
  });
  await env.cleanup();
});
