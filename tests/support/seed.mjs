// 에뮬레이터용 가상 데이터 시드 — 실제 교육생 이름·게시물을 쓰지 않는다.
//   npm run seed        (에뮬레이터 실행 중일 때) 데이터 초기화 후 다시 채움
//   E2E 테스트는 각 spec의 beforeAll에서 seed()를 호출한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// npm 스크립트·Playwright 모두 저장소 루트에서 실행된다 (Playwright가 CJS로 변환하므로 import.meta 미사용)
const ROOT = process.cwd();

export const PROJECT_ID = "demo-padolet";
export const SUPER_ADMIN = { email: "jongbin@gmail.com", name: "최고관리자" };
export const TEACHER = { email: "teacher@example.com", name: "가상강사" };

export const SEED = {
  main: { id: "seed-main", code: "TEST", title: "가상 교육 — 실습 세션" },
  empty: { id: "seed-empty", code: "EMPT", title: "가상 교육 — 빈 세션" },
  ended: { id: "seed-ended", code: "ENDD", title: "가상 교육 — 종료된 세션" },
  owner: "seed-owner",
  longFileName: "실습안내_아주_긴_파일명_테스트_2026년_10월_교육자료_최종본_수정본_진짜최종.txt",
};

// 1×1 투명 PNG (68 bytes)
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const minutesAgo = (m) => Timestamp.fromMillis(Date.now() - m * 60_000);

export async function createTestEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(path.join(ROOT, "firestore.rules"), "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync(path.join(ROOT, "storage.rules"), "utf8"),
    },
  });
}

async function clearAuth() {
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: "DELETE",
  });
}

/** Auth·Firestore·Storage 에뮬레이터가 모두 응답할 때까지 대기 (기동 순서가 제각각이라) */
export async function waitForEmulators(timeoutMs = 120_000) {
  const urls = ["http://127.0.0.1:9099", "http://127.0.0.1:8080", "http://127.0.0.1:9199"];
  const deadline = Date.now() + timeoutMs;
  for (const url of urls) {
    for (;;) {
      try {
        await fetch(url);
        break;
      } catch {
        if (Date.now() > deadline) throw new Error(`에뮬레이터 응답 없음: ${url}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
}

export async function seed() {
  await waitForEmulators();
  const env = await createTestEnv();
  await env.clearFirestore();
  await env.clearStorage();
  await clearAuth();

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const storage = ctx.storage();

    async function upload(sessionId, name, bytes, contentType) {
      const r = ref(storage, `padolet/${sessionId}/${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      await uploadBytes(r, bytes, { contentType });
      return getDownloadURL(r);
    }

    await setDoc(doc(db, "admins", TEACHER.email), {
      email: TEACHER.email,
      addedAt: Timestamp.now(),
      addedBy: SUPER_ADMIN.email,
    });

    const base = { description: "", requireGoogleLogin: false, bannedWords: [], blockedNames: [] };
    // participantCount는 7/8 이후 운영 데이터처럼 1에 멈춘 상태를 재현
    await setDoc(doc(db, "sessions", SEED.main.id), {
      ...base,
      title: SEED.main.title,
      code: SEED.main.code,
      createdBy: SEED.owner,
      createdAt: minutesAgo(120),
      participantCount: 1,
      status: "active",
    });
    await setDoc(doc(db, "sessions", SEED.empty.id), {
      ...base,
      title: SEED.empty.title,
      code: SEED.empty.code,
      createdBy: SEED.owner,
      createdAt: minutesAgo(60 * 24),
      participantCount: 0,
    });
    await setDoc(doc(db, "sessions", SEED.ended.id), {
      ...base,
      title: SEED.ended.title,
      code: SEED.ended.code,
      createdBy: SEED.owner,
      createdAt: minutesAgo(60 * 48),
      participantCount: 2,
      status: "ended",
      endedAt: minutesAgo(60 * 47),
    });

    const sid = SEED.main.id;
    const participants = [
      { id: "p-kim1", name: "김가상", isAnonymous: false, seen: 0 },
      { id: "p-kim2", name: "김가상", isAnonymous: false, seen: 30 }, // 동명이인
      { id: "p-anon", name: "익명#0001", isAnonymous: true, seen: 40 },
      { id: "p-lee", name: "이테스트", isAnonymous: false, seen: 1 },
    ];
    for (const p of participants) {
      await setDoc(doc(db, "sessions", sid, "participants", p.id), {
        name: p.name,
        isAnonymous: p.isAnonymous,
        isOnline: true,
        joinedAt: minutesAgo(100),
        lastSeenAt: minutesAgo(p.seen),
      });
    }

    const imageUrl = await upload(sid, "화면캡처.png", PNG_1PX, "image/png");
    const textBytes = Buffer.from("가상 실습 안내 파일입니다. ".repeat(12), "utf8");
    const fileUrl = await upload(sid, SEED.longFileName, textBytes, "text/plain; charset=utf-8");
    const emptyUrl = await upload(sid, "빈파일.txt", Buffer.alloc(0), "text/plain");

    const posts = [
      { id: "post-text", authorId: "p-kim1", authorName: "김가상", content: "첫 번째 가상 포스트잇입니다.", type: "text" },
      {
        id: "post-pinned",
        authorId: SEED.owner,
        authorName: "강사",
        content: "실습 자료는 아래 링크를 참고하세요.",
        type: "text",
        pinned: true,
        pinnedAt: minutesAgo(50),
      },
      { id: "post-link", authorId: "p-lee", authorName: "이테스트", content: "https://example.com/docs", type: "link" },
      {
        id: "post-image",
        authorId: "p-kim2",
        authorName: "김가상",
        content: "",
        type: "image",
        fileUrl: imageUrl,
        fileMeta: { name: "화면캡처.png", size: PNG_1PX.length, mimeType: "image/png" },
      },
      {
        id: "post-file",
        authorId: "p-anon",
        authorName: "익명#0001",
        content: "",
        type: "file",
        fileUrl,
        fileMeta: { name: SEED.longFileName, size: textBytes.length, mimeType: "text/plain" },
      },
      {
        id: "post-empty-file",
        authorId: "p-lee",
        authorName: "이테스트",
        content: "",
        type: "file",
        fileUrl: emptyUrl,
        fileMeta: { name: "빈파일.txt", size: 0, mimeType: "text/plain" },
      },
      {
        id: "post-question",
        authorId: "p-kim1",
        authorName: "김가상",
        content: "질문: 노트끼리 연결은 어떻게 하나요?",
        type: "text",
        isQuestion: true,
        commentCount: 1,
      },
      {
        id: "post-long",
        authorId: "p-lee",
        authorName: "이테스트",
        content: "긴 글 테스트 문장입니다. 줄바꿈 없이 이어지는 내용이 카드 폭을 넘지 않아야 합니다. ".repeat(20),
        type: "text",
      },
      {
        id: "post-long-url",
        authorId: "p-anon",
        authorName: "익명#0001",
        content: `참고 주소: https://example.com/${"very-long-path-segment/".repeat(8)}end`,
        type: "text",
      },
    ];
    for (const [i, p] of posts.entries()) {
      const { id, ...data } = p;
      await setDoc(doc(db, "sessions", sid, "posts", id), {
        ...data,
        gridIndex: i,
        color: "yellow",
        createdAt: minutesAgo(90 - i),
      });
    }
    await setDoc(doc(db, "sessions", sid, "posts", "post-question", "comments", "c1"), {
      authorId: SEED.owner,
      authorName: "강사",
      content: "대괄호 두 개로 노트 이름을 감싸면 됩니다.",
      createdAt: minutesAgo(70),
    });

    const messages = [
      { id: "m1", authorId: "p-kim1", authorName: "김가상", content: "안녕하세요", type: "text" },
      {
        id: "m2",
        authorId: "p-lee",
        authorName: "이테스트",
        content: "실습결과.txt",
        type: "file",
        fileUrl,
        fileMeta: { name: "실습결과.txt", size: 12_000, mimeType: "text/plain" },
      },
      {
        id: "m3",
        authorId: "p-kim2",
        authorName: "김가상",
        content: "",
        type: "image",
        fileUrl: imageUrl,
        fileMeta: { name: "화면캡처.png", size: PNG_1PX.length, mimeType: "image/png" },
      },
      {
        id: "m4",
        authorId: "p-anon",
        authorName: "익명#0001",
        content: "제 파일은 file:///C:/Users/test/Documents/노트.md 에 있어요",
        type: "text",
      },
      { id: "m5", authorId: "p-lee", authorName: "이테스트", content: "┃ 김가상: 안녕하세요\n반갑습니다", type: "text" },
      { id: "m6", authorId: "p-anon", authorName: "익명#0001", content: "가려질 메시지", type: "text", hidden: true },
    ];
    for (const [i, m] of messages.entries()) {
      const { id, ...data } = m;
      await setDoc(doc(db, "sessions", sid, "messages", id), { ...data, createdAt: minutesAgo(80 - i) });
    }

    await setDoc(doc(db, "sessions", sid, "polls", "poll1"), {
      question: "오늘 실습 난이도는?",
      options: ["쉬움", "보통", "어려움"],
      correctIndex: null,
      anonymous: false,
      active: true,
      endedAt: null,
      createdAt: minutesAgo(60),
      createdBy: SEED.owner,
    });
    for (const [voter, idx] of [["p-kim1", 0], ["p-lee", 1]]) {
      await setDoc(doc(db, "sessions", sid, "polls", "poll1", "votes", voter), {
        voterId: voter,
        voterName: voter,
        optionIndex: idx,
        createdAt: minutesAgo(59),
      });
    }
  });

  await env.cleanup();
}

if (process.argv[1] && path.basename(process.argv[1]) === "seed.mjs") {
  seed()
    .then(() => console.log("seed 완료 — 세션 코드:", Object.values(SEED).map((s) => s.code).filter(Boolean).join(", ")))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
