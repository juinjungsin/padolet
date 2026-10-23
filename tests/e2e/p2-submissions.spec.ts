import { test, expect, Page } from "@playwright/test";
import { seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin } from "./helpers";

// P2-01 실습별 제출함 — 실습·제출자·최신 제출·이력, 제출 성공 확인, 재제출·미제출 구분
test.describe.configure({ mode: "serial" });

let a: Page;
let b: Page;
let admin: Page;
const LEARNERS = 6; // 시드 4명 + A + B (강사 계정 제외)

async function openSubmissionTab(p: Page) {
  await p.getByRole("tab", { name: "제출" }).click();
}

test.beforeAll(async ({ browser }) => {
  await seed();
  a = await (await browser.newContext()).newPage();
  b = await (await browser.newContext()).newPage();
  admin = await (await browser.newContext()).newPage();
  await joinAsParticipant(a, SEED.main.code, "제출A");
  await joinAsParticipant(b, SEED.main.code, "제출B");
  await loginAsAdmin(admin, SUPER_ADMIN.email);
  await admin.goto(`/board/${SEED.main.id}`);
  await expect(admin.getByTestId("instructor-summary")).toBeVisible();
});

test("제출함을 켜기 전에는 제출 탭이 없다 (미사용 탭 비노출)", async () => {
  await expect(a.getByRole("tab", { name: "제출" })).toHaveCount(0);
});

test("강사가 실습에 제출함을 켜면 교육생에게 제출 탭과 '결과 제출하기'가 생긴다", async () => {
  await admin.getByRole("button", { name: "실습 안내 만들기" }).click();
  await admin.getByRole("button", { name: "새 실습 안내" }).click();
  await admin.getByLabel("모듈명").fill("3교시 — 결과 정리");
  await admin.getByLabel("실습 제목").fill("오늘 만든 노트 구조 제출");
  await admin.getByRole("checkbox", { name: /앱 안 제출함 열기/ }).check();
  await admin.getByRole("button", { name: "저장하고 현재 실습으로 지정" }).click();
  // 저장이 끝나 목록으로 돌아온 뒤 닫는다 (저장 중에는 닫히지 않음)
  await expect(admin.getByText("현재 실습", { exact: true })).toBeVisible();
  await admin.keyboard.press("Escape");
  await expect(admin.getByRole("dialog")).toHaveCount(0);

  await a.getByTestId("guide-banner").getByRole("button", { name: "결과 제출하기" }).click();
  await expect(a.getByRole("tab", { name: "제출" })).toHaveAttribute("aria-selected", "true");
  await expect(a.getByTestId("submission-state").first()).toHaveText(/미제출/);
  await expect(a.getByText("이 실습에 제출하면 다른 교육생의 최신 제출물을 볼 수 있습니다.", { exact: true })).toBeVisible();
});

test("업로드가 실패하면 제출로 기록하지 않는다 (미제출 유지)", async () => {
  await a.route("**/v0/b/**", (route) =>
    route.request().method() !== "GET"
      ? route.fulfill({ status: 403, contentType: "application/json", body: '{"error":{"code":403,"message":"denied"}}' })
      : route.continue()
  );
  await a.getByLabel(/제출할 내용/).fill("실패 시험");
  await a.getByTestId("submission-file-input").setInputFiles({ name: "fail.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await a.getByRole("button", { name: "제출하기", exact: true }).click();
  await expect(a.getByRole("alert").filter({ hasText: "업로드에 실패해 제출하지 않았습니다" })).toBeVisible();
  await expect(a.getByTestId("submission-state").first()).toHaveText(/미제출/);
  await a.unroute("**/v0/b/**");
});

test("제출 → 성공 확인, 제출 전 교육생은 다른 제출물을 볼 수 없다", async () => {
  // 앞 단계의 글과 파일이 그대로 남아 있어 다시 누르면 된다
  await a.getByRole("button", { name: "제출하기", exact: true }).click();
  await expect(a.getByRole("status").filter({ hasText: "제출되었습니다 · 1번째 제출" })).toBeVisible();
  await expect(a.getByTestId("submission-state").first()).toHaveText(/^제출/);
  await expect(a.getByText("아직 다른 제출물이 없습니다.")).toBeVisible();

  await openSubmissionTab(b);
  await expect(b.getByTestId("peer-submissions")).toHaveCount(0);
  await expect(b.getByText("실패 시험")).toHaveCount(0);

  await b.getByLabel(/제출할 내용/).fill("B의 결과물입니다");
  await b.getByRole("button", { name: "제출하기", exact: true }).click();
  await expect(b.getByRole("status").filter({ hasText: "1번째 제출" })).toBeVisible();
  const peers = b.getByTestId("peer-submissions");
  await expect(peers).toContainText("제출A");
  await expect(peers).toContainText("fail.txt");
});

test("다시 제출 → 재제출(2회)·이력 2건, 제출 성공 확인", async () => {
  await a.getByRole("button", { name: "지난 제출 내용 불러오기" }).click();
  await expect(a.getByLabel(/다시 제출할 내용/)).toHaveValue("실패 시험");
  await a.getByLabel(/다시 제출할 내용/).fill("수정한 결과물");
  await a.getByRole("button", { name: "다시 제출하기 (2번째)" }).click();
  await expect(a.getByRole("status").filter({ hasText: "2번째 제출" })).toBeVisible();
  await expect(a.getByTestId("submission-state").first()).toHaveText(/재제출 \(2회\)/);
  await a.getByText("내 제출 이력과 피드백 보기").click();
  await expect(a.getByTestId("submission-history").locator(":scope > li")).toHaveCount(2);
});

test("강사 — 실습별 제출 현황과 피드백, 다시 제출하면 피드백 대기로", async () => {
  await openSubmissionTab(admin);
  await expect(admin.getByTestId("submission-summary")).toContainText(`제출 2 · 재제출 1 · 미제출 ${LEARNERS - 2}`);
  const row = admin.getByTestId("instructor-submissions").locator("li", { hasText: "제출A" }).first();
  await row.getByRole("button", { name: "보기·피드백" }).click();
  await row.getByLabel("2번째 제출에 피드백").fill("구조가 깔끔합니다");
  await row.getByRole("button", { name: "피드백 저장" }).click();
  await expect(row.getByText("저장했습니다")).toBeVisible();
  await expect(admin.getByTestId("submission-summary")).toContainText("피드백 완료 1");

  await expect(a.getByTestId("feedback-state").first()).toHaveText(/피드백 완료/);
  await expect(a.getByTestId("submission-history")).toContainText("구조가 깔끔합니다");

  await a.getByLabel(/다시 제출할 내용/).fill("피드백 반영본");
  await a.getByRole("button", { name: "다시 제출하기 (3번째)" }).click();
  await expect(a.getByTestId("feedback-state").first()).toHaveText(/피드백 대기/);
  await expect(admin.getByTestId("submission-summary")).toContainText("피드백 완료 0");
  // 이전 피드백은 이력에 그대로
  await expect(a.getByTestId("submission-history")).toContainText("구조가 깔끔합니다");
});

test("교육생은 남의 이력·피드백을 볼 수 없고, 보고서에는 제출 섹션이 나온다", async () => {
  await expect(b.getByTestId("peer-submissions")).not.toContainText("구조가 깔끔합니다");
  // 다른 교육생 카드에는 피드백 여부도 보이지 않는다
  await expect(b.getByTestId("peer-submissions").getByTestId("feedback-state")).toHaveCount(0);
  // 제출 탭에는 포스트잇 입력 카드가 없지만 '질문하기'는 질문 입력으로 이어진다
  await expect(b.getByRole("button", { name: /포스트잇 남기기/ })).toHaveCount(0);
  await b.getByTestId("guide-banner").getByRole("button", { name: "질문하기" }).click();
  await expect(b.getByRole("radio", { name: "질문" })).toHaveAttribute("aria-checked", "true");
  await admin.goto(`/admin/report/${SEED.main.id}`);
  const section = admin.getByTestId("report-submissions");
  await expect(section).toContainText("실습 제출 — 3교시 — 결과 정리");
  await expect(section).toContainText("제출A · 3번째 제출");
  await admin.getByRole("checkbox", { name: "참여자 명단 포함" }).uncheck();
  await expect(section).not.toContainText("제출A");
  await expect(section).toContainText("교육생 1");
});
