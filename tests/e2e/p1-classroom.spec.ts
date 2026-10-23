import { test, expect, Page } from "@playwright/test";
import { seed, SEED, SUPER_ADMIN } from "../support/seed.mjs";
import { joinAsParticipant, loginAsAdmin, openComposer } from "./helpers";

// P1-01 현재 실습 안내, P1-03 질문 상태, P1-04 진행·도움 요청, P1-06 로컬 경로
// 교육생 두 명 + 강사 한 명 동시 사용 (QA-03, QA-04, QA-05, QA-09)
test.describe.configure({ mode: "serial" });

let a: Page; // 교육생 A
let b: Page; // 교육생 B
let admin: Page;
const banner = (p: Page) => p.getByTestId("guide-banner");
const summary = () => admin.getByTestId("instructor-summary");
const qCard = (p: Page, text: string) => p.getByTestId("questions-list").locator("div.group", { hasText: text });
const visibleChat = (p: Page) => p.locator('[data-testid="chat-panel"]:visible');

// 시드 4명 + A + B = 교육생 6명 (강사 계정은 집계 제외)
const LEARNERS = 6;

test.beforeAll(async ({ browser }) => {
  await seed();
  a = await (await browser.newContext()).newPage();
  b = await (await browser.newContext()).newPage();
  admin = await (await browser.newContext()).newPage();
  for (const [p, name] of [
    [a, "교육생A"],
    [b, "교육생B"],
  ] as const) {
    await joinAsParticipant(p, SEED.main.code, name);
    await expect(p).toHaveURL(new RegExp(`/board/${SEED.main.id}$`));
  }
  await loginAsAdmin(admin, SUPER_ADMIN.email);
  await admin.goto(`/board/${SEED.main.id}`);
  await expect(summary()).toBeVisible();
  // 외부 접속 감시 — 로컬 경로(file:// obsidian://)로 요청이 나가면 안 된다 (QA-09)
  for (const p of [a, b, admin]) {
    p.on("request", (req) => {
      if (/^(file|obsidian):/i.test(req.url())) throw new Error(`로컬 경로 요청 발생: ${req.url()}`);
    });
  }
});

test("활성 실습이 없을 때 자연스러운 빈 상태 (P1-01)", async () => {
  await expect(a.getByText("지금은 진행 중인 실습 안내가 없습니다.")).toBeVisible();
  await expect(admin.getByRole("button", { name: "실습 안내 만들기" })).toBeVisible();
  await expect(summary()).toContainText("현재 실습이 없어 진행 집계가 없습니다.");
});

test("강사가 실습 안내를 만들면 교육생 화면 상단에 실시간 고정, 입력 중인 글은 유지 (P1-01)", async () => {
  // A가 글을 쓰는 중에 안내가 바뀌어도 초안이 지워지지 않아야 한다
  await openComposer(a);
  await a.getByLabel("포스트잇 내용").fill("작성 중인 초안");

  await admin.getByRole("button", { name: "실습 안내 만들기" }).click();
  await admin.getByRole("button", { name: "새 실습 안내" }).click();
  await admin.getByLabel("모듈명").fill("2교시 — 노트 연결");
  await admin.getByLabel("실습 제목").fill("노트 3개를 링크로 연결하기");
  await admin.getByLabel("설명 (할 일)").fill("대괄호 두 개로 노트를 연결해 보세요.");
  await admin.getByRole("button", { name: "링크 추가" }).click();
  await admin.getByLabel("링크 1 이름").fill("실습 가이드");
  await admin.getByLabel("링크 1 주소").fill("https://example.com/guide");
  await admin.getByRole("checkbox", { name: SEED.longFileName }).check();
  await admin.getByLabel("마감 (선택)").fill("2026-10-23T15:30");
  await admin.getByLabel("제출 링크 (선택)").fill("https://example.com/submit");
  await admin.getByRole("button", { name: "저장하고 현재 실습으로 지정" }).click();
  await expect(admin.getByText("현재 실습", { exact: true })).toBeVisible();
  await admin.keyboard.press("Escape");

  const g = banner(a);
  await expect(g).toContainText("노트 3개를 링크로 연결하기");
  await expect(g).toContainText("2교시 — 노트 연결");
  await expect(g.getByRole("link", { name: "실습 가이드" })).toHaveAttribute("href", "https://example.com/guide");
  await expect(g.getByRole("link", { name: /실습안내_아주_긴/ })).toBeVisible();
  await expect(g).toContainText("마감 10월 23일 오후 3:30");
  await expect(g.getByRole("link", { name: "제출 링크 열기" })).toBeVisible();
  await expect(a.getByLabel("포스트잇 내용")).toHaveValue("작성 중인 초안");

  // 새로고침 후에도 유지
  await b.reload();
  await expect(banner(b)).toContainText("노트 3개를 링크로 연결하기");
  // 교육생은 편집할 수 없다
  await expect(banner(b).getByRole("button", { name: /편집/ })).toHaveCount(0);
});

test("진행 상태 — 반복 클릭으로 집계가 늘지 않고, 취소·변경·재접속 유지 (P1-04, QA-05)", async () => {
  const done = banner(a).getByRole("button", { name: "실습 완료" });
  await done.click();
  await expect(done).toHaveAttribute("aria-pressed", "true");
  await expect(summary()).toContainText(`완료 1 · 진행 중 0 · 응답 없음 ${LEARNERS - 1}`);

  await done.click(); // 다시 누르면 취소
  await expect(done).toHaveAttribute("aria-pressed", "false");
  await expect(summary()).toContainText("완료 0 · 진행 중 0");

  await done.click();
  await banner(b).getByRole("button", { name: "진행 중" }).click();
  await expect(summary()).toContainText(`완료 1 · 진행 중 1 · 응답 없음 ${LEARNERS - 2}`);
  // 교육생 화면은 집계만
  await expect(banner(b)).toContainText("완료 1명 · 진행 중 1명");

  await a.reload();
  await expect(banner(a).getByRole("button", { name: "실습 완료" })).toHaveAttribute("aria-pressed", "true");
  await expect(summary()).toContainText("완료 1 · 진행 중 1");
});

test("도움 요청 — 강사만 요청자를 보고, 확인·처리는 실습 완료와 별개 (P1-04, QA-04)", async () => {
  await banner(b).getByRole("button", { name: "도움 필요" }).click();
  await expect(banner(b)).toContainText("도움 요청을 보냈습니다");
  await expect(summary().getByRole("button", { name: "도움 요청 1" })).toBeVisible();
  // 다른 교육생 화면에는 요청자 정보가 없다
  await expect(a.getByText("교육생B", { exact: true })).toHaveCount(0);

  await summary().getByRole("button", { name: "도움 요청 1" }).click();
  const list = admin.getByTestId("help-list");
  await expect(list).toContainText("교육생B");
  await expect(list).toContainText("2교시 — 노트 연결");
  await list.getByRole("button", { name: "확인" }).click();
  await expect(banner(b)).toContainText("강사가 도움 요청을 확인했습니다");
  await list.getByRole("button", { name: "처리 완료" }).click();
  await expect(banner(b)).toContainText("도움 요청이 처리되었습니다");
  await expect(admin.getByText("처리할 도움 요청이 없습니다.")).toBeVisible();

  // 진행 현황 — 이름별 상태, 도움 처리 후에도 B는 '진행 중' 그대로
  const progressList = admin.getByTestId("progress-list");
  await expect(progressList.locator("li", { hasText: "교육생B" })).toContainText("진행 중");
  await expect(progressList.locator("li", { hasText: "교육생A" })).toContainText("완료");
  await admin.keyboard.press("Escape");
  await expect(banner(b).getByRole("button", { name: "진행 중" })).toHaveAttribute("aria-pressed", "true");
});

test("질문 — 질문하기·저도 궁금해요(1회)·상태 변경·재열기·미답변 집계 (P1-03)", async () => {
  await banner(a).getByRole("button", { name: "질문하기" }).click();
  await expect(a.getByRole("radio", { name: "질문" })).toHaveAttribute("aria-checked", "true");
  await a.getByLabel("포스트잇 내용").fill("링크가 빨간색으로 보여요");
  await a.getByRole("button", { name: "게시", exact: true }).click();
  // A의 초안 + 질문: 초안은 위에서 남아 있었으므로 질문 내용으로 교체됨
  await expect(qCard(a, "링크가 빨간색으로 보여요")).toContainText("접수");
  await expect(qCard(a, "링크가 빨간색으로 보여요")).toContainText("내 질문");

  // 미답변 집계 — 시드 질문 1 + 새 질문 1
  await expect(summary().getByRole("button", { name: "미답변 질문 2" })).toBeVisible();

  await b.getByRole("tab", { name: /질문/ }).click();
  const meToo = qCard(b, "링크가 빨간색으로 보여요").getByRole("button", { name: /저도 궁금해요/ });
  await meToo.click();
  await expect(meToo).toHaveText(/저도 궁금해요 1/);
  await meToo.click(); // 취소
  await expect(meToo).toHaveText(/저도 궁금해요 0/);
  await meToo.click();
  await expect(qCard(a, "링크가 빨간색으로 보여요")).toContainText("저도 궁금해요 1");
  // 교육생에게는 상태 변경 수단이 없다
  await expect(qCard(b, "링크가 빨간색으로 보여요").getByLabel("처리 상태")).toHaveCount(0);

  await admin.getByRole("tab", { name: /질문/ }).click();
  const adminCard = qCard(admin, "링크가 빨간색으로 보여요");
  await adminCard.getByLabel("처리 상태").selectOption("answering");
  await expect(qCard(a, "링크가 빨간색으로 보여요").getByTestId("question-status")).toHaveText("답변 중");
  await expect(summary().getByRole("button", { name: "미답변 질문 1" })).toBeVisible();
  await adminCard.getByLabel("처리 상태").selectOption("resolved");
  await expect(qCard(a, "링크가 빨간색으로 보여요").getByTestId("question-status")).toHaveText("해결");
  await adminCard.getByLabel("처리 상태").selectOption("open"); // 재열기
  await expect(qCard(a, "링크가 빨간색으로 보여요").getByTestId("question-status")).toHaveText("접수");

  // 미답변 버튼 → 접수 상태만 보기
  await summary().getByRole("button", { name: /미답변 질문/ }).click();
  await expect(admin.getByLabel("질문 상태 필터")).toHaveValue("open");

  // 내 질문 필터
  await a.getByRole("button", { name: "내 질문" }).click();
  await expect(a.getByTestId("questions-list").locator("div.group")).toHaveCount(1);
});

test("대화 메시지를 질문으로 등록 — 원본 유지, 중복 생성 없음 (P1-03)", async () => {
  const chat = visibleChat(admin);
  const msg = chat.locator('[data-message-id="m1"]');
  await msg.getByRole("button", { name: "메시지 메뉴" }).click();
  await admin.getByRole("menuitem", { name: /질문으로 등록/ }).click();
  await expect(msg).toContainText("질문으로 등록됨");
  // 이미 등록한 메시지는 메뉴에 등록 항목이 없다 (중복 생성 방지)
  await msg.getByRole("button", { name: "메시지 메뉴" }).click();
  await expect(admin.getByRole("menuitem", { name: /질문으로 등록/ })).toHaveCount(0);
  await admin.keyboard.press("Escape");
  await expect(chat).toContainText("안녕하세요"); // 원본 메시지 그대로

  await admin.getByLabel("질문 상태 필터").selectOption("all");
  const moved = qCard(admin, "안녕하세요");
  await expect(moved).toHaveCount(1);
  await expect(moved).toContainText("대화에서 옮긴 질문");
  await expect(moved).toContainText("김가상");
});

test("로컬 경로 안내 — 포스트잇·대화 모두, 안내 후 그대로 게시 가능 (P1-06, QA-09)", async () => {
  await a.getByRole("tab", { name: "보드" }).click();
  await openComposer(a);
  await a.getByRole("radio", { name: "일반" }).click();
  await a.getByLabel("포스트잇 내용").fill("제 볼트는 obsidian://open?vault=교육 입니다");
  await a.getByRole("button", { name: "게시", exact: true }).click();
  const notice = a.getByTestId("local-path-notice");
  await expect(notice).toContainText("내 컴퓨터의 파일 경로일 수 있습니다");
  await expect(notice).toContainText("obsidian://open?vault=교육");
  const chooser = a.waitForEvent("filechooser");
  await notice.getByRole("button", { name: "파일 첨부하기" }).click();
  await chooser; // 파일 선택 창이 열린다 (선택은 취소)
  await notice.getByRole("button", { name: "그대로 게시" }).click();
  await expect(a.locator('[data-testid="post-board"]:visible')).toContainText("제 볼트는 obsidian://open?vault=교육 입니다");

  await a.getByLabel("메시지 입력").fill("파일은 file:///C:/work/결과.md 에 있어요");
  await a.getByLabel("메시지 입력").press("Enter");
  const chatNotice = a.getByTestId("chat-local-path-notice");
  await expect(chatNotice).toBeVisible();
  await chatNotice.getByRole("button", { name: "그대로 보내기" }).click();
  await expect(visibleChat(admin)).toContainText("파일은 file:///C:/work/결과.md 에 있어요");
});

test("모듈 필터 — 현재 실습 중에 올린 글만 골라 보기", async () => {
  await admin.getByRole("tab", { name: "보드" }).click();
  await admin.getByLabel("모듈 필터").selectOption({ label: "2교시 — 노트 연결" });
  const board = admin.locator('[data-testid="post-board"]:visible');
  await expect(board).toContainText("제 볼트는 obsidian://");
  await expect(board).not.toContainText("첫 번째 가상 포스트잇입니다.");
});
