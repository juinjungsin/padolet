import { test, expect, Browser, Page } from "@playwright/test";
import { seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin } from "./helpers";

// 기존 주요 기능 회귀 (QA-01, QA-11 일부) — 교육생 1명 + 관리자 1명, 서로 다른 브라우저 컨텍스트
test.describe.configure({ mode: "serial" });

let student: Page;
let admin: Page;

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

const visible = (page: Page, testId: string) => page.locator(`[data-testid="${testId}"]:visible`);

test.beforeAll(async ({ browser }) => {
  await seed();
  student = await newPage(browser);
  admin = await newPage(browser);
  await joinAsParticipant(student, SEED.main.code, "회귀테스트");
  await expect(student).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
  await loginAsAdmin(admin, SUPER_ADMIN.email);
  await admin.goto(`/board/${SEED.main.id}`);
  await expect(visible(admin, "post-board")).toBeVisible();
});

test("기존 게시물·첨부·댓글·고정 상태가 보존되어 보인다 (QA-01)", async () => {
  const board = visible(student, "post-board");
  await expect(board).toContainText("첫 번째 가상 포스트잇입니다.");
  await expect(board).toContainText(SEED.longFileName);
  await expect(board.getByRole("img", { name: "화면캡처.png" })).toBeVisible();
  await expect(board).toContainText("고정됨");
  const question = board.locator("div.group", { hasText: "노트끼리 연결은" });
  await expect(question.getByTitle("댓글")).toContainText("1"); // 댓글 수
});

test("교육생 글 게시 → 관리자 화면에 실시간 반영", async () => {
  await student.getByPlaceholder("포스트잇에 내용을 작성하세요").first().fill("회귀 테스트 게시물");
  await student.getByRole("button", { name: "게시", exact: true }).first().click();
  await expect(visible(admin, "post-board")).toContainText("회귀 테스트 게시물");
});

test("교육생 파일 첨부 업로드 → 파일명·용량 표시", async () => {
  const input = student.locator('form input[type="file"]').first();
  await input.setInputFiles({ name: "실습결과.txt", mimeType: "text/plain", buffer: Buffer.from("가".repeat(700)) });
  const board = visible(admin, "post-board");
  await expect(board).toContainText("실습결과.txt");
  await expect(board).toContainText("2.1 KB"); // 700자 × 3바이트 = 2,100 B
});

test("댓글 작성 → 상대 화면에 댓글 수 반영", async () => {
  const card = visible(student, "post-board").locator("div.group", { hasText: "첫 번째 가상 포스트잇입니다." });
  await card.getByTitle("댓글").click();
  await card.getByPlaceholder("댓글 달기...").fill("회귀 댓글");
  await card.getByPlaceholder("댓글 달기...").press("Enter");
  const adminCard = visible(admin, "post-board").locator("div.group", { hasText: "첫 번째 가상 포스트잇입니다." });
  await expect(adminCard.getByTitle("댓글")).toContainText("1");
});

test("대화 전송 → 상대 화면 반영", async () => {
  await student.getByPlaceholder("메시지 입력...").fill("회귀 대화 메시지");
  await student.getByPlaceholder("메시지 입력...").press("Enter");
  await expect(visible(admin, "chat-panel")).toContainText("회귀 대화 메시지");
});

test("투표 참여 (QA-11)", async () => {
  await student.getByTitle("투표 / 퀴즈").click();
  await student.getByRole("button", { name: /어려움/ }).click();
  await expect(student.getByText("내 선택: 어려움")).toBeVisible();
  await student.keyboard.press("Escape");
});

test("관리자 고정(게시물 메뉴) → 교육생 화면에 고정됨 표시", async () => {
  const card = visible(admin, "post-board").locator("div.group", { hasText: "회귀 테스트 게시물" });
  await card.getByRole("button", { name: "게시물 메뉴" }).click();
  await admin.getByRole("menuitem", { name: "고정", exact: true }).click();
  const studentCard = visible(student, "post-board").locator("div.group", { hasText: "회귀 테스트 게시물" });
  await expect(studentCard).toContainText("고정됨");
});

test("교육생은 남의 글 게시물 메뉴가 없고, 본인 글에는 수정·삭제만 있다", async () => {
  const others = visible(student, "post-board").locator("div.group", { hasText: "첫 번째 가상 포스트잇입니다." });
  await expect(others.getByRole("button", { name: "게시물 메뉴" })).toHaveCount(0);
  const mine = visible(student, "post-board").locator("div.group", { hasText: "회귀 테스트 게시물" });
  await mine.getByRole("button", { name: "게시물 메뉴" }).click();
  await expect(student.getByRole("menuitem")).toHaveText([/수정/, "삭제"]);
  await student.keyboard.press("Escape");
});

test("보드 잠금(강사 도구) → 교육생 작성 차단, 해제 후 복구 (QA-11)", async () => {
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "강사 도구" }).click();
  await admin.getByRole("menuitem", { name: /보드 잠금/ }).click();
  await expect(student.getByText("보드가 잠금 상태입니다.").first()).toBeVisible();
  await expect(student.getByPlaceholder("보드가 잠금 상태입니다 — 열람만 가능합니다").first()).toBeDisabled();

  await admin.getByRole("button", { name: "강사 도구" }).click();
  await admin.getByRole("menuitem", { name: "보드 잠금 해제" }).click();
  await expect(student.getByPlaceholder("포스트잇에 내용을 작성하세요").first()).toBeEnabled();
});
