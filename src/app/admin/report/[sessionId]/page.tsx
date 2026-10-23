"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  getComments,
  getSession,
  getRole,
  isSuperAdmin,
  Post,
  Message,
  Participant,
} from "@/lib/firestore";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db as getDb, waitForAuthUser } from "@/lib/firebase";
import {
  buildReportMarkdown,
  DEFAULT_REPORT_OPTIONS,
  getAttachment,
  ReportData,
  ReportOptions,
  splitReply,
} from "@/lib/report";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { METRICS } from "@/lib/metrics";
import { isSafeExternalUrl } from "@/lib/url-safe";

type LoadState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "ready"; data: ReportData };

/**
 * 권한 확인 후 보고서 데이터 로드.
 * 세션 소유자 판별은 보드와 같은 기준 — Firebase uid(신규), NextAuth id(7/8 이전 구 세션), 최고 관리자.
 */
async function loadReport(
  sessionId: string,
  email: string | null,
  legacyId: string | undefined
): Promise<LoadState> {
  if (!email) return { status: "denied" };
  if ((await getRole(email)) === "none") return { status: "denied" };
  const session = await getSession(sessionId);
  if (!session) return { status: "denied" };

  if (!isSuperAdmin(email)) {
    // NextAuth → Firebase 이중 로그인이 끝날 때까지 대기
    const fbUser = await waitForAuthUser(10_000, { requireGoogle: true });
    const owns =
      (!!fbUser && session.createdBy === fbUser.uid) || (!!legacyId && session.createdBy === legacyId);
    if (!owns) return { status: "denied" };
  }

  const db = getDb();
  const [pSnap, postSnap, msgSnap] = await Promise.all([
    getDocs(query(collection(db, "sessions", sessionId, "participants"), orderBy("joinedAt", "asc"))),
    getDocs(query(collection(db, "sessions", sessionId, "posts"), orderBy("gridIndex", "asc"))),
    getDocs(query(collection(db, "sessions", sessionId, "messages"), orderBy("createdAt", "asc"))),
  ]);
  const posts = postSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
  // commentCount가 없는 구 포스트도 확인 (0으로 확정된 것만 건너뜀)
  const commentEntries = await Promise.all(
    posts
      .filter((p) => p.id && p.commentCount !== 0)
      .map(async (p) => [p.id!, await getComments(sessionId, p.id!)] as const)
  );

  return {
    status: "ready",
    data: {
      session,
      participants: pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participant),
      posts,
      comments: Object.fromEntries(commentEntries.filter(([, list]) => list.length > 0)),
      messages: msgSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message),
    },
  };
}

function AttachmentLine({
  item,
  includeLinks,
  inline = false,
}: {
  item: Post | Message;
  includeLinks: boolean;
  /** 대화 줄처럼 작성자 이름 뒤에 이어 붙일 때 */
  inline?: boolean;
}) {
  const a = getAttachment(item);
  if (!a) return null;
  const linkable = includeLinks && !!a.url && isSafeExternalUrl(a.url);
  const Tag = inline ? "span" : "p";
  return (
    <Tag className={`text-sm text-ink break-all ${inline ? "" : "block"}`}>
      <span className="text-slate-text">첨부({a.kind}): </span>
      {linkable ? (
        <a href={a.url!} target="_blank" rel="noopener noreferrer" className="text-blueprint underline">
          {a.name}
        </a>
      ) : (
        a.name
      )}
      <span className="text-slate-text"> · {a.size}</span>
    </Tag>
  );
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  const sessionId = params.sessionId as string;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [options, setOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  // 다시 시도 시 증가 → 로드 effect 재실행
  const [attempt, setAttempt] = useState(0);

  const email = authSession?.user?.email || null;
  const legacyId = (authSession?.user as Record<string, unknown> | undefined)?.id as string | undefined;

  useEffect(() => {
    if (authStatus === "loading") return;
    let cancelled = false;
    loadReport(sessionId, email, legacyId)
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch((err) => {
        // 네트워크 등 일시 오류는 권한 없음과 구분해 다시 시도할 수 있게 한다
        console.error("[report] 보고서 로드 실패", err);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, sessionId, email, legacyId, attempt]);

  if (state.status === "loading") {
    return (
      <div role="status" className="flex-1 flex items-center justify-center bg-transparent text-slate-text">
        보고서를 불러오는 중...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-graphite mb-3">보고서를 불러오지 못했습니다</h2>
          <p className="text-sm text-slate-text mb-6">연결 상태를 확인한 뒤 다시 시도해주세요.</p>
          <Button
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            다시 시도
          </Button>
        </Card>
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent p-6">
        <Card className="max-w-md p-8 text-center">
          <h2
            className="font-display text-2xl text-graphite mb-3"
            style={{ fontWeight: 700, letterSpacing: "-0.6px" }}
          >
            접근 권한이 없습니다
          </h2>
          <p className="text-sm text-slate-text mb-6">
            이 보고서는 세션을 만든 관리자 또는 최고 관리자만 열람할 수 있습니다.
          </p>
          <Button onClick={() => router.push("/")}>홈으로</Button>
        </Card>
      </div>
    );
  }

  const { data } = state;
  const { session, participants, posts, comments, messages } = data;

  function markdown() {
    return buildReportMarkdown({ ...data, generatedAt: new Date() }, options);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(markdown());
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 2500);
  }

  function downloadReport() {
    const blob = new Blob([markdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(session.title || "padolet").replace(/[\\/:*?"<>|]/g, "_")}_보고서.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 브라우저 인쇄 다이얼로그 → "PDF로 저장". 인쇄용 CSS는 globals.css의 @media print
  const exportPdf = () => window.print();

  const actions = (
    <div className="flex gap-2 flex-wrap" data-print-hide>
      <Button variant="ghost" onClick={() => router.push(`/board/${sessionId}`)}>
        보드로 돌아가기
      </Button>
      <Button variant="ghost" onClick={handleCopy}>
        {copyState === "done" ? "복사됨" : copyState === "error" ? "복사 실패 — 다시 시도" : "MD 복사"}
      </Button>
      <Button variant="ghost" onClick={exportPdf}>
        PDF 내보내기
      </Button>
      <Button onClick={downloadReport}>MD 다운로드</Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-6 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h1
            className="font-display text-3xl md:text-4xl text-graphite break-keep"
            style={{ fontWeight: 700, letterSpacing: "-0.9px" }}
          >
            {session.title} — 보고서
          </h1>
          {actions}
        </div>

        <fieldset className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink" data-print-hide>
          <legend className="sr-only">내보내기 옵션</legend>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeParticipants}
              onChange={(e) => setOptions((o) => ({ ...o, includeParticipants: e.target.checked }))}
              className="accent-graphite w-4 h-4"
            />
            참여자 명단 포함
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.includeLinks}
              onChange={(e) => setOptions((o) => ({ ...o, includeLinks: e.target.checked }))}
              className="accent-graphite w-4 h-4"
            />
            첨부 다운로드 링크 포함
          </label>
          <p className="w-full text-xs text-slate-text">
            첨부 링크는 주소를 아는 사람 누구나 열 수 있습니다. 외부에 공유할 보고서라면 링크와 명단을 빼고 내보내세요.
          </p>
        </fieldset>

        <div className="space-y-6">
          <Card className="p-6" >
            <div data-testid="report-summary">
              <p className="text-sm font-semibold text-graphite mb-3">세션 정보</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-ink">
                <dt className="text-slate-text">입장 코드</dt>
                <dd>{session.code}</dd>
                <dt className="text-slate-text">생성일</dt>
                <dd>{formatDate(session.createdAt) || "-"}</dd>
                <dt className="text-slate-text">{METRICS.cumulative.label}</dt>
                <dd>{participants.length}명</dd>
                <dt className="text-slate-text">포스트잇</dt>
                <dd>{posts.length}개</dd>
                <dt className="text-slate-text">대화</dt>
                <dd>{messages.length}건</dd>
              </dl>
              <p className="mt-3 text-xs text-slate-text">{METRICS.cumulative.help}</p>
            </div>
          </Card>

          {options.includeParticipants && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-graphite mb-3">참여자 ({participants.length}명)</p>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-ink">
                {participants.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.isAnonymous ? " (익명)" : ""}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="p-6">
            <div data-testid="report-posts">
              <p className="text-sm font-semibold text-graphite mb-3">포스트잇 ({posts.length}개)</p>
              <ol className="space-y-4">
                {posts.map((p, i) => {
                  const list = (p.id && comments[p.id]) || [];
                  const tags = [p.pinned && "고정됨", p.isQuestion && "질문", p.editedAt && "수정됨"].filter(Boolean);
                  return (
                    <li key={p.id} className="border-b border-silver-mist pb-3 last:border-0 break-inside-avoid">
                      <p className="text-xs text-slate-text mb-1">
                        {i + 1}. {p.authorName} · {formatDateTime(p.createdAt) || "시각 미확인"}
                        {tags.length > 0 && <span className="ml-2 text-graphite">({tags.join(" · ")})</span>}
                      </p>
                      {p.content?.trim() && (
                        <p className="text-sm text-ink whitespace-pre-wrap break-words">{p.content}</p>
                      )}
                      <AttachmentLine item={p} includeLinks={options.includeLinks} />
                      {!p.content?.trim() && !getAttachment(p) && (
                        <p className="text-sm text-slate-text">(내용 없음)</p>
                      )}
                      {list.length > 0 && (
                        <ul className="mt-2 pl-4 border-l-2 border-silver-mist space-y-1">
                          {list.map((c) => (
                            <li key={c.id} className="text-xs text-ink">
                              <span className="text-slate-text">
                                {c.authorName} ({formatTime(c.createdAt)}):
                              </span>{" "}
                              {c.content}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold text-graphite mb-3">대화 ({messages.length}건)</p>
            <ul className="space-y-2">
              {messages.map((m) => {
                const { quote, body } = splitReply(m.content || "");
                const a = getAttachment(m);
                return (
                  <li key={m.id} className="text-sm text-ink break-words">
                    <span className="text-slate-text">
                      [{formatTime(m.createdAt) || "--:--"}] {m.authorName}:
                    </span>{" "}
                    {m.hidden ? (
                      <span className="text-slate-text">(관리자가 숨긴 메시지)</span>
                    ) : a ? (
                      <AttachmentLine item={m} includeLinks={options.includeLinks} inline />
                    ) : (
                      <span className="whitespace-pre-wrap">
                        {body}
                        {quote && <span className="text-slate-text"> (답글 대상 — {quote})</span>}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="mt-10 pt-6 border-t border-silver-mist" data-print-hide>
          {actions}
        </div>
      </div>
    </div>
  );
}
