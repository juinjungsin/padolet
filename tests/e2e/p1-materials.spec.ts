import { test, expect, Page } from "@playwright/test";
import { seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin, openComposer } from "./helpers";

// P1-02 자료 분류·검색 + P1-06 프롬프트 카드 (QA-06, QA-07)
test.describe.configure({ mode: "serial" });

let student: Page;
let admin: Page;
const board = (p: Page) => p.locator('[data-testid="post-board"]:visible');
const card = (p: Page, text: string) => board(p).locator("div.group", { hasText: text });

// 앞뒤 공백·빈 줄·들여쓰기·코드 서식까지 원문 그대로 복사돼야 한다
const PROMPT_BODY = "  역할: 회의록 정리 도우미\n\n다음 회의록을 요약해줘:\n```\n- 안건 1\n    - 세부\n```\n";

test.beforeAll(async ({ browser }) => {
  await seed();
  const sctx = await browser.newContext();
  await sctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  student = await sctx.newPage();
  admin = await (await browser.newContext()).newPage();
  await joinAsParticipant(student, SEED.main.code, "자료검증");
  await expect(student).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
  await loginAsAdmin(admin, SUPER_ADMIN.email);
  await admin.goto(`/board/${SEED.main.id}`);
  await expect(board(admin)).toBeVisible();
});

test("교육생 유형 선택에는 공지가 없고, 강사에게만 있다", async () => {
  await openComposer(student);
  await openComposer(admin);
  const kinds = student.getByRole("radiogroup", { name: "게시물 유형" }).getByRole("radio");
  await expect(kinds).toHaveText(["일반", "질문", "자료", "프롬프트"]);
  await expect(admin.getByRole("radiogroup", { name: "게시물 유형" }).getByRole("radio", { name: "공지" })).toBeVisible();
});

test("자료 — 제목 + 파일 첨부 → 보드 카드와 자료 목록에 제목·형식·용량 표시", async () => {
  await openComposer(student);
  await student.getByRole("radio", { name: "자료" }).click();
  await student.getByLabel("자료 제목 (선택)").fill("2일차 실습 안내서");
  await student.getByLabel("포스트잇 내용").fill("실습 전에 읽어 주세요");
  // 입력 카드와 대화창에 파일 입력이 하나씩 — 첫 번째가 포스트잇 입력 카드
  await student.locator('form input[type="file"]').first().setInputFiles({
    name: "day2_guide.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 가상 파일"),
  });
  const c = card(admin, "2일차 실습 안내서");
  await expect(c).toContainText("자료");
  await expect(c).toContainText("day2_guide.pdf");

  await admin.getByRole("tab", { name: "자료" }).click();
  const list = admin.getByTestId("materials-list");
  const row = list.getByRole("listitem").filter({ hasText: "2일차 실습 안내서" });
  await expect(row).toContainText("PDF");
  await expect(row).toContainText("실습 전에 읽어 주세요");
  await expect(row.getByRole("link", { name: /열기/ })).toBeVisible();
  // 일반 텍스트 글은 자료 목록에 없다 (원본 복제 없이 같은 게시물을 거른 것)
  await expect(list).not.toContainText("첫 번째 가상 포스트잇입니다.");
  // 기존 첨부 전용 게시물은 파일명으로 표시
  await expect(list).toContainText(SEED.longFileName);
  await admin.getByRole("tab", { name: "보드" }).click();
});

test("프롬프트 — 제목·사용 목적·서식 유지 본문, 복사 결과가 원문과 같다 (P1-06)", async () => {
  await openComposer(student);
  await student.getByRole("radio", { name: "프롬프트" }).click();
  await student.getByLabel("프롬프트 제목").fill("회의록 요약");
  await student.getByLabel("사용 목적 (선택)").fill("회의 직후 정리할 때");
  await student.getByLabel("포스트잇 내용").fill(PROMPT_BODY);
  await student.getByRole("button", { name: "게시", exact: true }).click();

  const c = card(student, "회의록 요약");
  await expect(c).toContainText("프롬프트");
  await expect(c).toContainText("사용 목적 · 회의 직후 정리할 때");
  await c.getByRole("button", { name: "프롬프트 복사" }).click();
  await expect(c.getByRole("button", { name: "복사됨" })).toBeVisible();
  // Windows 클립보드는 줄바꿈을 CRLF로 저장하므로 줄바꿈만 맞춰 비교 (공백·들여쓰기·빈 줄은 그대로 검사)
  const copied = await student.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, "\n")).toBe(PROMPT_BODY);
});

test("검색·유형·강사 게시 필터 조합과 결과 없음 안내 (QA-07)", async () => {
  const search = admin.getByLabel("포스트잇 검색");
  await search.fill("DAY2_GUIDE");
  await expect(card(admin, "2일차 실습 안내서")).toBeVisible();
  await expect(board(admin).locator("div.group")).toHaveCount(1);

  await search.fill("존재하지않는검색어");
  await expect(admin.getByText("“존재하지않는검색어”에 해당하는 포스트잇이 없습니다.")).toBeVisible();
  await search.fill("");

  await admin.getByLabel("게시물 유형 필터").selectOption("question");
  await expect(board(admin).locator("div.group")).toHaveCount(1);
  await expect(board(admin)).toContainText("노트끼리 연결은");

  await admin.getByLabel("게시물 유형 필터").selectOption("");
  await admin.getByRole("button", { name: "강사 게시" }).click();
  // 시드의 강사 글(세션 소유자 작성 — 이전 데이터 규칙)만 남는다
  await expect(board(admin).locator("div.group")).toHaveCount(1);
  await expect(board(admin)).toContainText("실습 자료는 아래 링크를 참고하세요.");
  await admin.getByRole("button", { name: "강사 게시" }).click();
});

test("강사 공지 — 교육생 화면에 강사 공지로 강조 표시", async () => {
  await openComposer(admin);
  await admin.getByRole("radio", { name: "공지" }).click();
  await admin.getByLabel("포스트잇 내용").fill("10분 뒤 실습 결과를 공유합니다");
  await admin.getByRole("button", { name: "게시", exact: true }).click();
  const c = card(student, "10분 뒤 실습 결과를 공유합니다");
  await expect(c).toContainText("강사 공지");
  await expect(c).toHaveAttribute("data-post-kind", "notice");
});

test("360px — 자료 목록의 긴 파일명이 화면을 넘지 않는다 (QA-06)", async () => {
  await student.setViewportSize({ width: 360, height: 800 });
  await student.getByRole("tab", { name: "자료" }).click();
  await expect(student.getByTestId("materials-list")).toContainText(SEED.longFileName.slice(0, 10));
  const { scrollWidth, clientWidth } = await student.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
