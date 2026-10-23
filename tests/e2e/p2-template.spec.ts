import { test, expect } from "@playwright/test";
import { doc, setDoc } from "firebase/firestore";
import { createTestEnv, seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { loginAsAdmin } from "./helpers";

// P2-02 세션 템플릿 — 안내·모듈·강사 자료 구조 재사용, 교육생 글·대화·제출물은 복사하지 않음
test.beforeAll(async () => {
  await seed();
  const env = await createTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // 시드의 강사 글(post-pinned, 작성자 = 세션 소유자)을 자료로 연결한 실습 안내
    await setDoc(doc(db, `sessions/${SEED.main.id}/modules/m1`), {
      title: "1교시 — 설치",
      order: 0,
      practiceTitle: "옵시디언 설치하기",
      description: "설치 후 볼트를 만드세요.",
      links: [{ label: "설치 가이드", url: "https://example.com/install" }],
      materialPostIds: ["post-pinned", "post-file"],
      dueAt: "2026-10-23T11:00",
      submitUrl: null,
      submissionEnabled: true,
    });
    await setDoc(doc(db, `sessions/${SEED.main.id}/submissions/m1__p-kim1`), {
      moduleId: "m1",
      uid: "p-kim1",
      name: "김가상",
      version: 1,
      text: "교육생 제출물",
      files: [],
      feedbackStatus: "none",
    });
  });
  await env.cleanup();
});

test("템플릿으로 복제 — 실습 안내와 강사 자료만 새 세션으로, 교육생 활동은 제외", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.getByTestId(`session-row-${SEED.main.id}`).getByRole("button", { name: /더보기/ }).click();
  await page.getByRole("menuitem", { name: "템플릿으로 복제" }).click();

  const dialog = page.getByRole("dialog", { name: "템플릿으로 복제" });
  await expect(dialog).toContainText("실습 안내 (1개)");
  await expect(dialog).toContainText("강사가 올린 자료·프롬프트·공지 (1개)");
  await expect(dialog).toContainText("교육생 글·질문·대화·제출물·참여자·투표는 복사하지 않습니다.");
  await dialog.getByLabel("새 세션 제목").fill("가상 교육 — 2회차");
  await dialog.getByLabel(/교육일/).fill("2026-11-05");
  await dialog.getByRole("button", { name: "새 세션 만들기" }).click();

  await expect(page.getByRole("dialog", { name: "입장 QR 코드" })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).last().click();
  const row = page.getByTestId(/^session-row-/).filter({ hasText: "가상 교육 — 2회차" });
  await expect(row).toContainText("교육일 2026. 11. 05.");

  // 새 세션 보드 — 강사 글만 있고 교육생 글·대화는 없다
  await row.getByRole("button", { name: "보드 열기" }).click();
  const board = page.locator('[data-testid="post-board"]:visible');
  await expect(board).toContainText("실습 자료는 아래 링크를 참고하세요.");
  await expect(board).toContainText("고정됨");
  await expect(board).not.toContainText("첫 번째 가상 포스트잇입니다.");
  await expect(board).not.toContainText("노트끼리 연결은");
  await expect(page.locator('[data-testid="chat-panel"]:visible')).not.toContainText("안녕하세요");
  await expect(page.getByText("아직 현재 실습을 지정하지 않았습니다.")).toBeVisible();

  // 실습 안내를 현재 실습으로 지정 — 자료 연결이 새 게시물로 이어지고, 교육생 자료 연결과 마감은 빠짐
  await page.getByRole("button", { name: "실습 안내 만들기" }).click();
  await expect(page.getByRole("list", { name: "실습 목록" })).toContainText("옵시디언 설치하기");
  await page.getByRole("button", { name: "현재 실습으로 지정" }).click();
  await page.keyboard.press("Escape");
  const banner = page.getByTestId("guide-banner");
  await expect(banner).toContainText("옵시디언 설치하기");
  await expect(banner.getByRole("link", { name: "설치 가이드" })).toBeVisible();
  await expect(banner).toContainText("자료: 실습 자료는 아래 링크를 참고하세요.");
  await expect(banner).not.toContainText("실습안내_아주_긴"); // 교육생이 올린 파일 연결은 복사 안 함
  await expect(banner).not.toContainText("마감");

  // 제출함 설정은 이어지지만 제출물은 없다
  await page.getByRole("tab", { name: "제출" }).click();
  await expect(page.getByTestId("submission-summary")).toContainText("제출 0");
});
