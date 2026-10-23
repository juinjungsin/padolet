import { test, expect, Page } from "@playwright/test";
import { seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin } from "./helpers";

// 반응형·키보드 (QA-12) — 지정 5개 폭에서 가로 넘침·메뉴 줄바꿈·주요 버튼 잘림이 없어야 한다
const WIDTHS = [360, 390, 768, 1280, 1440];

test.beforeAll(async () => {
  await seed();
});

async function expectNoHorizontalOverflow(page: Page, where: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${where}: 가로 스크롤 발생`).toBeLessThanOrEqual(clientWidth + 1);
}

/** 상단 메뉴가 한 줄(64px)을 유지하고, 모든 메뉴 항목이 화면 안에 있는지 */
async function expectNavIntact(page: Page, where: string) {
  const nav = page.locator("nav").first();
  const box = await nav.boundingBox();
  // 64px(h-16) + 테두리. 간격 토큰 문제로 16px로 잘렸던 회귀도 잡는다
  expect(box?.height, `${where}: 상단 메뉴 높이`).toBeGreaterThanOrEqual(56);
  expect(box?.height, `${where}: 상단 메뉴 높이`).toBeLessThanOrEqual(65);
  const width = page.viewportSize()!.width;
  for (const el of await nav.locator("a, button, [role=img]").all()) {
    if (!(await el.isVisible())) continue;
    const b = (await el.boundingBox())!;
    expect(b.x + b.width, `${where}: 메뉴 항목이 화면 밖으로 잘림`).toBeLessThanOrEqual(width + 1);
    expect(b.height, `${where}: 메뉴 항목 줄바꿈`).toBeLessThanOrEqual(48);
  }
}

for (const width of WIDTHS) {
  test(`${width}px — 홈·입장·교육생 보드·관리자 보드·관리자 목록·보고서`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await ctx.newPage();
    const shot = (name: string) => page.screenshot({ path: test.info().outputPath(`${width}-${name}.png`), fullPage: false });

    await page.goto("/");
    await expectNoHorizontalOverflow(page, "홈");
    await shot("home");

    await joinAsParticipant(page, SEED.main.code, "화면폭검증");
    await expect(page).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
    await expect(page.locator('[data-testid="post-board"]:visible')).toBeVisible();
    await expectNoHorizontalOverflow(page, "교육생 보드");
    await expectNavIntact(page, "교육생 보드");
    await shot("board-student");

    const adminCtx = await browser.newContext({ viewport: { width, height: 800 } });
    const admin = await adminCtx.newPage();
    await loginAsAdmin(admin, SUPER_ADMIN.email);
    await expectNoHorizontalOverflow(admin, "관리자 목록");
    await admin.screenshot({ path: test.info().outputPath(`${width}-admin-list.png`) });

    await admin.goto(`/board/${SEED.main.id}`);
    await expect(admin.locator('[data-testid="post-board"]:visible')).toBeVisible();
    await expectNoHorizontalOverflow(admin, "관리자 보드");
    await expectNavIntact(admin, "관리자 보드");
    await expect(admin.getByRole("button", { name: "강사 도구" })).toBeInViewport();
    // 대화·보드 영역 버튼 글자가 여러 줄로 끊기지 않아야 한다 (텍스트 줄 수를 직접 센다 —
    // 버튼 높이가 고정이면 글자가 넘쳐도 박스 높이는 그대로라 높이로는 못 잡는다)
    const wrapped = await admin.evaluate(() => {
      const bad: string[] = [];
      const areas = document.querySelectorAll('[data-testid="chat-panel"], main#board-panel');
      areas.forEach((area) =>
        area.querySelectorAll("button").forEach((btn) => {
          if (!(btn as HTMLElement).offsetParent) return;
          const tops = new Set<number>();
          const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of Array.from(range.getClientRects())) tops.add(Math.round(r.top / 4));
          }
          if (tops.size > 1) bad.push(btn.textContent?.trim() ?? "");
        })
      );
      return bad;
    });
    expect(wrapped, `${width}px 줄바꿈된 버튼`).toEqual([]);
    await admin.screenshot({ path: test.info().outputPath(`${width}-board-admin.png`) });

    await admin.goto(`/admin/report/${SEED.main.id}`);
    await expect(admin.getByTestId("report-summary")).toBeVisible();
    await expectNoHorizontalOverflow(admin, "보고서");

    await ctx.close();
    await adminCtx.close();
  });
}

test("키보드 — 강사 도구 메뉴 열기·이동·닫기 후 포커스 복귀", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(`/board/${SEED.main.id}`);
  const trigger = page.getByRole("button", { name: "강사 도구" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const items = page.getByRole("menuitem");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("키보드 — 모달은 포커스를 가두고 Esc로 닫으면 연 버튼으로 돌아간다", async ({ page }) => {
  await joinAsParticipant(page, SEED.main.code, "키보드검증");
  await expect(page).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
  const opener = page.getByRole("button", { name: /참여자 보기/ });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("긴 글은 접혀 있고 펼쳐보기로 전체를 볼 수 있다 (QA-06)", async ({ page }) => {
  await joinAsParticipant(page, SEED.main.code, "접기검증");
  const card = page.locator('[data-testid="post-board"]:visible div.group', { hasText: "긴 글 테스트 문장" });
  const toggle = card.getByRole("button", { name: "펼쳐보기" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(card.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
  // 접혀도 댓글·리액션 버튼은 계속 접근 가능
  await expect(card.getByTitle("댓글")).toBeVisible();
});
