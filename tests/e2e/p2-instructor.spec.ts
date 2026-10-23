import { test, expect } from "@playwright/test";
import { doc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { createTestEnv, seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin } from "./helpers";

// P2-03 강사 진행 화면 — 도움 요청·미답변 질문·진행·제출 현황을 한 화면에, 집계 대상 명시
const URL = `/board/${SEED.main.id}/instructor`;

test.beforeAll(async () => {
  await seed();
  const env = await createTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const s = `sessions/${SEED.main.id}`;
    await setDoc(doc(db, `${s}/modules/m1`), {
      title: "3교시 — 결과 정리",
      order: 0,
      practiceTitle: "노트 구조 제출",
      description: "",
      links: [],
      materialPostIds: [],
      submissionEnabled: true,
    });
    await updateDoc(doc(db, s), { activeModuleId: "m1" });
    await setDoc(doc(db, `${s}/progress/m1__p-kim1`), { moduleId: "m1", uid: "p-kim1", status: "done" });
    await setDoc(doc(db, `${s}/progress/m1__p-lee`), { moduleId: "m1", uid: "p-lee", status: "doing" });
    await setDoc(doc(db, `${s}/helpRequests/m1__p-kim2`), { moduleId: "m1", uid: "p-kim2", name: "김가상", status: "open", requestedAt: Timestamp.now() });
    await setDoc(doc(db, `${s}/submissions/m1__p-kim1`), {
      moduleId: "m1",
      uid: "p-kim1",
      name: "김가상",
      version: 1,
      text: "구조 정리본",
      files: [],
      submittedAt: Timestamp.now(),
      feedbackStatus: "none",
    });
  });
  await env.cleanup();
});

test("교육생은 강사 진행 화면을 볼 수 없다 (요청자 이름 노출 없음)", async ({ page }) => {
  await joinAsParticipant(page, SEED.main.code, "엿보기");
  await page.goto(URL);
  await expect(page.getByText("강사만 볼 수 있는 화면입니다")).toBeVisible();
  await expect(page.getByTestId("instructor-screen")).toHaveCount(0);
});

// 앞 테스트에서 교육생 1명(엿보기)이 입장해 교육생은 시드 4명 + 1명 = 5명
test("한 화면에 네 가지 현황과 집계 대상이 보이고, 처리하면 바로 반영된다", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(URL);
  const screen = page.getByTestId("instructor-screen");
  await expect(screen).toContainText("집계 대상: 교육생 5명");
  const tiles = page.getByTestId("instructor-tiles");
  await expect(tiles).toContainText("처리할 도움 요청1건");
  await expect(tiles).toContainText("미답변 질문1개");
  await expect(tiles).toContainText("실습 완료1 / 5명");
  await expect(tiles).toContainText("제출1 / 5명");
  await expect(tiles).toContainText("미제출 4");

  // 도움 요청 처리
  await page.getByTestId("help-list").getByRole("button", { name: "처리 완료" }).click();
  await expect(tiles).toContainText("처리할 도움 요청0건");

  // 미답변 질문 상태 변경 → 목록과 집계에서 빠짐
  await page.getByTestId("unanswered-list").getByLabel("처리 상태").selectOption("answering");
  await expect(tiles).toContainText("미답변 질문0개");
  await expect(page.getByText("미답변 질문이 없습니다.")).toBeVisible();

  // 진행·제출 상세
  await expect(page.getByTestId("progress-list")).toContainText("이테스트");
  await expect(page.getByTestId("instructor-submissions")).toContainText("김가상");
});

test("보드의 강사 도구 메뉴에서 열 수 있고, 좁은 화면에서도 가로로 넘치지 않는다", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(`/board/${SEED.main.id}`);
  await page.getByRole("button", { name: "강사 도구" }).click();
  await expect(page.getByRole("menuitem", { name: "강사 진행 화면 (새 창)" })).toHaveAttribute("href", URL);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(URL);
  await expect(page.getByTestId("instructor-tiles")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
