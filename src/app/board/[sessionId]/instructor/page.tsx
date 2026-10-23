"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import ConnectionBanner from "@/components/ui/ConnectionBanner";
import SpotlightControl from "@/components/board/SpotlightControl";
import { HelpRequestList, ProgressList } from "@/components/board/InstructorPanel";
import { InstructorSubmissions } from "@/components/board/SubmissionsView";
import { isSuperAdmin, onParticipants, onPosts, onSession, Participant, Post, QuestionStatus, Session } from "@/lib/firestore";
import { onHelpRequests, onModuleProgress, onModules, onModuleSubmissions, setQuestionStatus } from "@/lib/classroom";
import { HelpRequest, Module, pendingHelp, Progress, PROGRESS_HELP, summarizeProgress } from "@/lib/practice";
import { isUnanswered, meTooCount, QUESTION_STATUSES, questionStatus, sortQuestions, UNANSWERED_HELP } from "@/lib/question";
import { Submission, SUBMISSION_SUMMARY_HELP, summarizeSubmissions } from "@/lib/submission";
import { formatTime } from "@/lib/format";
import { RiArrowLeftLine, RiHandHeartLine, RiQuestionLine, RiCheckboxCircleLine, RiUploadCloud2Line } from "react-icons/ri";

const control =
  "touch-target h-9 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite cursor-pointer";

function SummaryTile({ icon, label, value, help, tone }: { icon: React.ReactNode; label: string; value: string; help: string; tone?: "warn" }) {
  return (
    <div className={`p-4 rounded-xl border ${tone === "warn" ? "border-warn/30 bg-warn-bg" : "border-silver-mist bg-chalk-card"}`}>
      <p className={`flex items-center gap-1.5 text-sm font-semibold ${tone === "warn" ? "text-warn" : "text-slate-text"}`}>
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-graphite tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-text">{help}</p>
    </div>
  );
}

/** 강사 진행 화면 (P2-03) — 도움 요청·미답변 질문·진행·제출 현황을 한 화면에, 집계 대상 명시 */
export default function InstructorPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { data: authSession, status: authStatus } = useSession();
  const [firebaseUid, setFirebaseUid] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<(Session & { id: string }) | null | undefined>(undefined);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [helpRequests, setHelpRequests] = useState<(HelpRequest & { id: string })[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [onlyThisModule, setOnlyThisModule] = useState(false);

  useEffect(() => onAuthStateChanged(firebaseAuth(), (u) => setFirebaseUid(u && !u.isAnonymous ? u.uid : null)), []);
  useEffect(() => onSession(sessionId, setSession), [sessionId]);

  const legacyId = (authSession?.user as Record<string, unknown> | undefined)?.id as string | undefined;
  const isAdmin =
    !!session &&
    ((!!firebaseUid && session.createdBy === firebaseUid) ||
      (!!legacyId && session.createdBy === legacyId) ||
      isSuperAdmin(authSession?.user?.email));

  useEffect(() => {
    if (!isAdmin) return;
    const unsubs = [
      onParticipants(sessionId, setParticipants),
      onModules(sessionId, setModules),
      onPosts(sessionId, setPosts),
      onHelpRequests(sessionId, setHelpRequests),
    ];
    return () => unsubs.forEach((u) => u());
  }, [sessionId, isAdmin]);

  const activeModuleId = session?.activeModuleId ?? null;
  const selectedId = picked ?? activeModuleId ?? modules[0]?.id ?? null;
  const selected = (modules.find((m) => m.id === selectedId) as (Module & { id: string }) | undefined) ?? null;

  useEffect(() => {
    if (!isAdmin || !selectedId) return;
    const unsubs = [onModuleProgress(sessionId, selectedId, setProgress), onModuleSubmissions(sessionId, selectedId, setSubmissions)];
    return () => unsubs.forEach((u) => u());
  }, [sessionId, isAdmin, selectedId]);

  if (authStatus === "loading" || session === undefined || firebaseUid === undefined) {
    return (
      <div role="status" className="flex-1 flex items-center justify-center text-slate-text">
        강사 진행 화면을 불러오는 중...
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold text-graphite mb-3">강사만 볼 수 있는 화면입니다</h1>
          <p className="text-sm text-slate-text mb-6">세션을 만든 관리자 또는 최고 관리자로 로그인해 주세요.</p>
          <Link href="/admin" className="font-semibold text-blueprint hover:underline">
            관리자 로그인
          </Link>
        </Card>
      </div>
    );
  }

  // 집계 대상 = 교육생 (세션 소유자·지금 보고 있는 관리자 계정 제외)
  const learners = participants.filter((p) => p.id !== session.createdBy && p.id !== firebaseUid);
  const learnerIds = learners.map((p) => p.id!).filter(Boolean);
  const progressSummary = selected ? summarizeProgress(progress, selected.id, learners.length) : null;
  const pendingCount = pendingHelp(helpRequests, onlyThisModule ? selectedId : null).length;
  const unanswered = sortQuestions(
    posts.filter((p) => isUnanswered(p) && (!onlyThisModule || p.moduleId === selectedId)),
    "meToo"
  );
  const submissionSummary = selected?.submissionEnabled ? summarizeSubmissions(submissions, selected.id, learnerIds) : null;
  const moduleTitle = (id?: string | null) => modules.find((m) => m.id === id)?.title;

  return (
    <div className="flex flex-col min-h-screen">
      <Nav wide sessionTitle={session.title} sessionCode={session.code} participantCount={participants.length} isAdmin />
      <ConnectionBanner />
      <SpotlightControl sessionId={sessionId} session={session} posts={posts} />
      <main className="w-full max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-6" data-testid="instructor-screen">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-graphite mr-auto">강사 진행 화면</h1>
          {modules.length > 0 && (
            <select value={selectedId ?? ""} onChange={(e) => setPicked(e.target.value)} aria-label="실습 선택" className={control}>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} — {m.practiceTitle}
                  {m.id === activeModuleId ? " (현재 실습)" : ""}
                </option>
              ))}
            </select>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={onlyThisModule}
              onChange={(e) => setOnlyThisModule(e.target.checked)}
              className="accent-graphite w-4 h-4"
            />
            도움 요청·질문도 이 실습만
          </label>
          <Link
            href={`/board/${sessionId}`}
            className="touch-target inline-flex items-center gap-1 h-9 px-3 rounded-full border border-silver-mist text-sm font-semibold text-ink hover:border-graphite"
          >
            <RiArrowLeftLine size={16} aria-hidden />
            보드로
          </Link>
        </div>

        <p className="text-sm text-slate-text">
          집계 대상: 교육생 {learners.length}명 (이 세션에 입장한 브라우저 중 강사·관리자 계정 제외). 화면은 실시간으로 갱신됩니다.
        </p>

        <section aria-label="요약" className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="instructor-tiles">
          <SummaryTile
            icon={<RiHandHeartLine size={16} aria-hidden />}
            label="처리할 도움 요청"
            value={`${pendingCount}건`}
            help={onlyThisModule ? "선택한 실습의 요청·확인 상태" : "모든 실습의 요청·확인 상태"}
            tone={pendingCount > 0 ? "warn" : undefined}
          />
          <SummaryTile
            icon={<RiQuestionLine size={16} aria-hidden />}
            label="미답변 질문"
            value={`${unanswered.length}개`}
            help={UNANSWERED_HELP}
          />
          <SummaryTile
            icon={<RiCheckboxCircleLine size={16} aria-hidden />}
            label="실습 완료"
            value={progressSummary ? `${progressSummary.done} / ${learners.length}명` : "—"}
            help={progressSummary ? `진행 중 ${progressSummary.doing} · 응답 없음 ${progressSummary.noResponse}. ${PROGRESS_HELP}` : "실습 안내가 없습니다."}
          />
          <SummaryTile
            icon={<RiUploadCloud2Line size={16} aria-hidden />}
            label="제출"
            value={submissionSummary ? `${submissionSummary.submitted} / ${learners.length}명` : "—"}
            help={
              submissionSummary
                ? `미제출 ${submissionSummary.notSubmitted} · 재제출 ${submissionSummary.resubmitted} · 피드백 완료 ${submissionSummary.reviewed}. ${SUBMISSION_SUMMARY_HELP}`
                : "선택한 실습에 제출함이 없습니다."
            }
          />
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h2 className="text-lg font-bold text-graphite mb-3">도움 요청</h2>
            <HelpRequestList
              sessionId={sessionId}
              adminUid={firebaseUid!}
              helpRequests={helpRequests}
              modules={modules}
              moduleId={onlyThisModule ? selectedId : null}
            />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold text-graphite mb-1">미답변 질문</h2>
            <p className="text-xs text-slate-text mb-3">‘저도 궁금해요’가 많은 순입니다. 답글은 보드의 질문 탭에서 달아 주세요.</p>
            {unanswered.length === 0 ? (
              <p className="text-sm text-slate-text">미답변 질문이 없습니다.</p>
            ) : (
              <ul className="space-y-2" data-testid="unanswered-list">
                {unanswered.map((q) => (
                  <li key={q.id} className="p-3 rounded-lg border border-silver-mist">
                    <p className="text-base text-ink line-clamp-3 whitespace-pre-wrap">{q.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-text">
                      <span className="font-semibold text-ink">{q.originalAuthorName ?? q.authorName}</span>
                      <span>{formatTime(q.createdAt)}</span>
                      {moduleTitle(q.moduleId) && <span>{moduleTitle(q.moduleId)}</span>}
                      <span>저도 궁금해요 {meTooCount(q)}</span>
                      <span>답글 {q.commentCount ?? 0}</span>
                      <label className="ml-auto inline-flex items-center gap-1.5">
                        처리 상태
                        <select
                          value={questionStatus(q)}
                          onChange={(e) => setQuestionStatus(sessionId, q.id!, e.target.value as QuestionStatus)}
                          className="touch-target h-8 px-2 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite cursor-pointer"
                        >
                          {QUESTION_STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold text-graphite mb-3">
              실습 진행 {selected ? `— ${selected.title}` : ""}
            </h2>
            <ProgressList module={selected} progress={progress} learners={learners} />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold text-graphite mb-3">
              제출 현황 {selected ? `— ${selected.title}` : ""}
            </h2>
            {selected?.submissionEnabled ? (
              <InstructorSubmissions sessionId={sessionId} module={selected} learners={learners} adminUid={firebaseUid!} />
            ) : (
              <p className="text-sm text-slate-text">
                선택한 실습에 제출함이 없습니다. 보드의 실습 안내 편집에서 ‘앱 안 제출함 열기’를 선택하세요.
              </p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
