import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { seed, SEED, SUPER_ADMIN, createTestEnv } from "../support/seed.mjs";
import { doc, updateDoc } from "firebase/firestore";
import { joinAsParticipant, loginAsAdmin } from "./helpers";
test.beforeAll(async () => { await seed(); });
test("우클릭 연결·새 창 편집·확대 축소·이미지 저장·공유", async ({ page }) => {
  await loginAsAdmin(page, SUPER_ADMIN.email);
  await page.goto(`/board/${SEED.main.id}`);
  await page.getByRole("tab", { name: "흐름도", exact: true }).click();
  await page.getByLabel("흐름도 제목", { exact: true }).fill("내보내기 검증");
  await page.getByRole("button", { name: "작업 추가", exact: true }).click();
  await page.getByLabel("단계 이름", { exact: true }).fill("접수");
  await page.getByRole("button", { name: "분기 추가", exact: true }).click();
  await page.getByLabel("단계 이름", { exact: true }).fill("검토");
  await page.getByRole("button", { name: "단계 접수", exact: true }).click();
  await page.getByRole("button", { name: "단계 검토", exact: true }).click({ button: "right" });
  await expect(page.getByLabel("단계 이름", { exact: true })).toHaveValue("접수");
  await page.getByText("연결선 목록·목록으로 연결", { exact: true }).click();
  await expect(page.getByRole("list", { name: "연결선 목록" })).toContainText("접수 → 검토");
  await page.getByRole("button", { name: "단계 검토", exact: true }).click({ button: "right" });
  await expect(page.getByRole("region", { name: "작업 흐름도" }).getByRole("alert")).toContainText("이미 연결");
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "새 창에서 크게 편집" }).click();
  const popup = await popupEvent;
  await expect(popup.getByLabel("단계 이름", { exact: true })).toHaveValue("접수");
  await popup.getByLabel("단계 이름", { exact: true }).fill("접수 수정");
  const canvas = popup.getByTestId("flow-canvas");
  const before = await canvas.getAttribute("viewBox");
  await popup.getByRole("button", { name: "흐름도 확대", exact: true }).click();
  await expect(canvas).not.toHaveAttribute("viewBox", before!);
  await popup.getByRole("button", { name: "흐름도 축소", exact: true }).click();
  await popup.getByRole("button", { name: "전체 보기", exact: true }).click();
  const source = popup.getByRole("button", { name: "단계 접수 수정", exact: true });
  const transform = await source.getAttribute("transform");
  const position = await source.boundingBox();
  await popup.mouse.move(position!.x + position!.width / 2, position!.y + position!.height / 2);
  await popup.mouse.down(); await popup.mouse.move(position!.x + position!.width / 2 - 80, position!.y + position!.height / 2, { steps: 5 }); await popup.mouse.up();
  await expect(source).not.toHaveAttribute("transform", transform!);
  await source.dblclick();
  await expect(canvas.getByRole("button")).toHaveCount(2);
  await canvas.hover(); await popup.mouse.wheel(0, 200);
  await popup.getByRole("button", { name: "전체 보기", exact: true }).click();
  for (const format of ["PNG", "JPG"]) {
    const downloadEvent = popup.waitForEvent("download");
    await popup.getByRole("button", { name: `${format} 저장`, exact: true }).click();
    const download = await downloadEvent;
    await download.saveAs(test.info().outputPath(`flowchart.${format.toLowerCase()}`));
    expect(download.suggestedFilename()).toBe(`내보내기 검증.${format.toLowerCase()}`);
    const bytes = await readFile((await download.path())!);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.subarray(0, format === "PNG" ? 4 : 2).toString("hex")).toBe(format === "PNG" ? "89504e47" : "ffd8");
  }
  await popup.close();
  await expect(page.getByLabel("단계 이름", { exact: true })).toHaveValue("접수 수정");
  await page.getByRole("button", { name: "흐름도 저장", exact: true }).click();
  await expect(page.getByText("흐름도를 저장했습니다.", { exact: true })).toBeVisible();
  for (const target of ["포스트잇", "대화"]) {
    await page.getByRole("button", { name: target === "포스트잇" ? "포스트잇으로 공유" : "대화로 공유", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "흐름도 공유 확인" });
    await expect(dialog.getByRole("img")).toBeVisible();
    await dialog.getByRole("button", { name: "공유하기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/에 흐름도 이미지를 공유했습니다/)).toBeVisible();
  }
  await page.getByRole("tab", { name: "보드", exact: true }).first().click();
  await expect(page.getByTestId("post-board").getByRole("heading", { name: "내보내기 검증" })).toBeVisible();
  await expect(page.getByTestId("chat-panel").getByRole("img", { name: "내보내기 검증.png" })).toBeVisible();
});

test("모바일 연결 대안·팝업 차단 안내·잠금 중 공유 차단", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await joinAsParticipant(page, SEED.main.code, "흐름도 교육생");
  await expect(page.getByRole("tab", { name: "흐름도", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "흐름도", exact: true }).click();
  await page.getByRole("button", { name: "작업 추가", exact: true }).click();
  await page.getByLabel("단계 이름", { exact: true }).fill("작업 A");
  await page.getByRole("button", { name: "분기 추가", exact: true }).click();
  await page.getByLabel("단계 이름", { exact: true }).fill("작업 B");
  await page.getByRole("button", { name: "단계 작업 A", exact: true }).click();
  await page.getByRole("button", { name: "선택 객체에서 연결", exact: true }).click();
  await page.getByRole("button", { name: "단계 작업 B", exact: true }).click();
  await page.getByText("연결선 목록·목록으로 연결", { exact: true }).click();
  await expect(page.getByRole("list", { name: "연결선 목록" })).toContainText("작업 A → 작업 B");
  await page.evaluate(() => { window.open = () => null; });
  await page.getByRole("button", { name: "새 창에서 크게 편집" }).click();
  await expect(page.getByRole("region", { name: "작업 흐름도" }).getByRole("alert")).toContainText("새 창이 차단");
  await page.getByRole("button", { name: "흐름도 저장", exact: true }).click();
  await expect(page.getByText("흐름도를 저장했습니다.", { exact: true })).toBeVisible();
  const env = await createTestEnv();
  try {
    await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), "sessions", SEED.main.id), { locked: true }));
    await expect(page.getByRole("button", { name: "포스트잇으로 공유", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "대화로 공유", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "작업 추가", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "PNG 저장", exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), "sessions", SEED.main.id), { locked: false })); await env.cleanup(); }
});
