import { test, expect, Page } from "@playwright/test";
import { doc, setDoc } from "firebase/firestore";
import { createTestEnv, seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { loginAsAdmin } from "./helpers";

// P2-04 프로젝터 크게 보기 — 질문 상태·저도 궁금해요, 작성자 이름 기본 숨김, 제출물은 고른 내용만
test.describe.configure({ mode: "serial" });

let admin: Page;
let projector: Page;
const FEEDBACK = "강사만 보는 피드백 문구";

const spotlight = () => projector.getByTestId("projector-spotlight");
const control = () => admin.getByTestId("spotlight-control");

test.beforeAll(async ({ browser }) => {
  await seed();
  const env = await createTestEnv();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `sessions/${SEED.main.id}/modules/m1`), {
      title: "1교시 — 설치",
      order: 0,
      practiceTitle: "옵시디언 설치하기",
      description: "",
      links: [],
      materialPostIds: [],
      dueAt: null,
      submitUrl: null,
      submissionEnabled: true,
    });
    const file = { name: "노트구조.md", size: 12, mimeType: "text/markdown", url: "https://example.com/note.md" };
    await setDoc(doc(db, `sessions/${SEED.main.id}/submissions/m1__p-lee`), {
      moduleId: "m1",
      uid: "p-lee",
      name: "이테스트",
      version: 2,
      text: "볼트를 주제별 폴더로 나눴습니다",
      files: [file],
      feedbackStatus: "reviewed",
      feedbackVersion: 2,
    });
    await setDoc(doc(db, `sessions/${SEED.main.id}/submissions/m1__p-lee/versions/2`), {
      version: 2,
      text: "볼트를 주제별 폴더로 나눴습니다",
      files: [file],
      feedback: FEEDBACK,
    });
  });
  await env.cleanup();

  const ctx = await browser.newContext();
  admin = await ctx.newPage();
  await loginAsAdmin(admin, SUPER_ADMIN.email);
  await admin.goto(`/board/${SEED.main.id}`);
  await expect(admin.getByTestId("instructor-summary")).toBeVisible();
  // 강사가 같은 브라우저에서 프로젝터 창을 따로 연다
  projector = await ctx.newPage();
  await projector.goto(`/board/${SEED.main.id}/projector`);
  await expect(projector.getByText(SEED.main.title).first()).toBeVisible();
});

test("질문을 크게 보기 — 상태·저도 궁금해요는 보이고 작성자 이름은 숨김", async () => {
  const card = admin.locator('[data-testid="post-board"]:visible').locator("div.group", { hasText: "노트끼리 연결은" });
  await card.getByRole("button", { name: "게시물 메뉴" }).click();
  await admin.getByRole("menuitem", { name: "프로젝터에 크게 보기" }).click();

  await expect(spotlight()).toContainText("질문: 노트끼리 연결은 어떻게 하나요?");
  await expect(spotlight()).toContainText("접수");
  await expect(spotlight()).toContainText("저도 궁금해요 0");
  await expect(spotlight()).not.toContainText("김가상");

  await expect(control()).toContainText("프로젝터 표시 중 · 질문");
  await expect(control().getByRole("button", { name: "이름 표시" })).toHaveAttribute("aria-pressed", "false");
});

test("강사가 이름 표시를 켜면 작성자가 보이고, 끄면 다시 숨는다", async () => {
  await control().getByRole("button", { name: "이름 표시" }).click();
  await expect(spotlight()).toContainText("— 김가상");
  await expect(control().getByRole("button", { name: "이름 숨기기" })).toHaveAttribute("aria-pressed", "true");

  await control().getByRole("button", { name: "이름 숨기기" }).click();
  await expect(spotlight()).not.toContainText("김가상");
});

test("제출물을 크게 보기 — 글·파일·회차만, 이름·피드백은 보이지 않음", async () => {
  await admin.getByRole("tab", { name: "제출" }).click();
  const row = admin.getByTestId("instructor-submissions").locator("li", { hasText: "이테스트" }).first();
  await row.getByRole("button", { name: "보기·피드백" }).click();
  await row.getByRole("button", { name: "프로젝터에 크게 보기 (이름 숨김)" }).click();

  await expect(spotlight()).toContainText("제출물 · 1교시 — 설치");
  await expect(spotlight()).toContainText("볼트를 주제별 폴더로 나눴습니다");
  await expect(spotlight()).toContainText("노트구조.md");
  await expect(spotlight()).toContainText("2번째 제출");
  await expect(spotlight()).not.toContainText("노트끼리 연결은"); // 앞의 질문은 내려감
  await expect(spotlight()).not.toContainText("이테스트");
  await expect(spotlight()).not.toContainText(FEEDBACK);
  await expect(spotlight()).not.toContainText("피드백");

  await control().getByRole("button", { name: "이름 표시" }).click();
  await expect(spotlight()).toContainText("— 이테스트");
  await expect(spotlight()).not.toContainText(FEEDBACK);
});

test("크게 보기 해제 — 프로젝터 오버레이와 강사 제어 줄이 사라진다", async () => {
  await control().getByRole("button", { name: "크게 보기 해제" }).click();
  await expect(spotlight()).toHaveCount(0);
  await expect(control()).toHaveCount(0);
});
