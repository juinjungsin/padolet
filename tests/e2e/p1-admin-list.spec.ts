import { test, expect, Page } from "@playwright/test";
import { seed, SEED, SUPER_ADMIN, TEACHER } from "../support/seed.mjs";
import { loginAsAdmin } from "./helpers";

// P1-05 관리자 목록과 메뉴 정리 (QA-11 종료·복제 회귀 포함)
test.describe.configure({ mode: "serial" });

let page: Page;
const row = (id: string) => page.getByTestId(`session-row-${id}`);
const rows = () => page.getByTestId(/^session-row-/);

async function rowMenu(id: string, item: string | RegExp) {
  await row(id).getByRole("button", { name: /더보기/ }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.beforeAll(async ({ browser }) => {
  await seed();
  page = await (await browser.newContext()).newPage();
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await expect(rows()).toHaveCount(3);
});

test("세션명 검색", async () => {
  await page.getByLabel("세션명 검색").fill("빈 세션");
  await expect(rows()).toHaveCount(1);
  await expect(rows().first()).toContainText(SEED.empty.title);
  await page.getByLabel("세션명 검색").fill("없는 세션");
  await expect(page.getByText("조건에 맞는 세션이 없습니다.")).toBeVisible();
  await page.getByLabel("세션명 검색").fill("");
});

test("교육일 설정 — 생성일과 따로 표시되고 교육일순 정렬에 반영", async () => {
  await expect(row(SEED.empty.id)).toContainText("교육일 미설정");
  await rowMenu(SEED.empty.id, /정보 수정/);
  await page.getByLabel(/교육일/).fill("2026-12-01");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(row(SEED.empty.id)).toContainText("교육일 2026. 12. 01.");
  await expect(row(SEED.empty.id)).toContainText("생성일");

  await page.getByLabel("정렬").selectOption("eventDate");
  await expect(rows().first()).toContainText(SEED.empty.title);
});

test("보관 — 기본 목록에서 숨고, 보관 필터에서 보이며, 새 입장이 막히고, 해제로 복구", async ({ browser }) => {
  await rowMenu(SEED.main.id, /보관/);
  await expect(row(SEED.main.id)).toHaveCount(0);
  await page.getByLabel("상태 필터").selectOption("archived");
  await expect(row(SEED.main.id)).toContainText("보관");

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/join?code=${SEED.main.code}`);
  await expect(guest.getByText("종료된 세션입니다. 새로 입장할 수 없습니다.")).toBeVisible();

  await rowMenu(SEED.main.id, "보관 해제");
  await page.getByLabel("상태 필터").selectOption("visible");
  await expect(row(SEED.main.id)).toContainText("진행 중");
});

test("종료 → 다시 진행, 설정 복제 (QA-11)", async () => {
  page.once("dialog", (d) => d.accept());
  await rowMenu(SEED.empty.id, /종료/);
  await expect(row(SEED.empty.id)).toContainText("종료");
  await rowMenu(SEED.empty.id, "다시 진행");
  await expect(row(SEED.empty.id)).toContainText("진행 중");

  page.once("dialog", (d) => d.accept());
  await rowMenu(SEED.empty.id, "설정 복제");
  await expect(page.getByRole("dialog", { name: "입장 QR 코드" })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).last().click();
  await expect(rows().filter({ hasText: `${SEED.empty.title} (복사)` })).toHaveCount(1);
});

test("긴 제목에서도 행동 버튼 접근 가능 (360px)", async () => {
  await rowMenu(SEED.empty.id, /정보 수정/);
  await page.getByLabel("세션 제목").fill("아주 긴 세션 제목 ".repeat(8));
  await page.getByRole("button", { name: "저장" }).click();
  await page.setViewportSize({ width: 360, height: 800 });
  const r = row(SEED.empty.id);
  for (const name of ["보드 열기", "보고서"]) await expect(r.getByRole("button", { name })).toBeInViewport();
  await expect(r.getByRole("button", { name: /더보기/ })).toBeInViewport();
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("관리자 권한 설정은 별도 화면 — 최고 관리자만", async ({ browser }) => {
  await page.getByRole("link", { name: "관리자 권한 설정" }).click();
  await expect(page.getByRole("heading", { name: "관리자 권한 관리" })).toBeVisible();
  await expect(page.getByText(TEACHER.email)).toBeVisible();

  const teacher = await (await browser.newContext()).newPage();
  await loginAsAdmin(teacher, TEACHER.email);
  await expect(teacher.getByRole("link", { name: "관리자 권한 설정" })).toHaveCount(0);
  await teacher.goto("/admin/settings");
  await expect(teacher.getByText("최고 관리자만 볼 수 있는 화면입니다.")).toBeVisible();
});
