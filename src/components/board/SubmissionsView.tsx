"use client";

import { useEffect, useRef, useState } from "react";
import { Participant } from "@/lib/firestore";
import { Module, memberDocId } from "@/lib/practice";
import {
  isReviewed,
  MAX_SUBMISSION_FILES,
  Submission,
  SUBMISSION_IDENTITY_NOTICE,
  SUBMISSION_STATE_LABEL,
  SUBMISSION_SUMMARY_HELP,
  SUBMISSION_VISIBILITY_NOTICE,
  SubmissionFile,
  submissionState,
  SubmissionVersion,
  summarizeSubmissions,
} from "@/lib/submission";
import { giveFeedback, onModuleSubmissions, onMySubmission, onSubmissionVersions, submitWork } from "@/lib/classroom";
import { uploadFile, validateFiles } from "@/lib/storage";
import { formatBytes, formatDateTime } from "@/lib/format";
import { isSafeExternalUrl } from "@/lib/url-safe";
import Button from "@/components/ui/Button";
import Collapsible from "@/components/ui/Collapsible";
import {
  RiAttachment2,
  RiAttachmentLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiInboxArchiveLine,
  RiMessage2Line,
} from "react-icons/ri";

interface SubmissionsViewProps {
  sessionId: string;
  isAdmin: boolean;
  modules: Module[];
  activeModuleId: string | null;
  participantId: string;
  participantName: string;
  /** 집계 대상 교육생 (강사·관리자 제외) */
  learners: Participant[];
}

const control =
  "touch-target h-9 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite cursor-pointer";

function FileChips({ files }: { files: SubmissionFile[] }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="제출 파일">
      {files.map((f) => (
        <li key={f.url}>
          {isSafeExternalUrl(f.url) ? (
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              title={f.name}
              className="touch-target inline-flex items-center gap-1 h-8 px-3 max-w-[260px] rounded-full bg-vellum border border-silver-mist text-sm font-semibold text-blueprint hover:border-blueprint"
            >
              <RiAttachment2 size={14} aria-hidden className="shrink-0" />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 text-xs font-normal text-ash-text">{formatBytes(f.size)}</span>
            </a>
          ) : (
            <span className="text-sm text-slate-text">{f.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function StateBadge({ sub, showFeedback = true }: { sub: Submission | null; showFeedback?: boolean }) {
  const state = submissionState(sub);
  const reviewed = isReviewed(sub);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        data-testid="submission-state"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          state === "none" ? "bg-warn-bg text-warn" : "bg-ok-bg text-sage"
        }`}
      >
        {state === "none" ? <RiInboxArchiveLine size={12} aria-hidden /> : <RiCheckboxCircleLine size={12} aria-hidden />}
        {SUBMISSION_STATE_LABEL[state]}
        {sub && sub.version > 1 && ` (${sub.version}회)`}
      </span>
      {sub && showFeedback && (
        <span
          data-testid="feedback-state"
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${reviewed ? "bg-buttercup text-ochre" : "bg-vellum text-slate-text"}`}
        >
          <RiMessage2Line size={12} aria-hidden />
          {reviewed ? "피드백 완료" : "피드백 대기"}
        </span>
      )}
    </span>
  );
}

/** 제출물 카드 (요구사항 5.2) — 실습명·제출자·제출 시각·파일·피드백 상태 */
export function SubmissionCard({
  sub,
  moduleTitle,
  showName = true,
  showFeedback = true,
}: {
  sub: Submission;
  moduleTitle: string;
  showName?: boolean;
  /** 다른 교육생 카드에서는 피드백 여부도 숨김 (피드백은 본인·강사만) */
  showFeedback?: boolean;
}) {
  return (
    <article data-testid="submission-card" className="p-4 rounded-xl border border-silver-mist bg-chalk-card shadow-[--shadow-card] space-y-2">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-semibold text-ochre">{moduleTitle}</span>
        {showName && <span className="text-sm font-semibold text-ink">{sub.name}</span>}
        <span className="text-xs text-ash-text">{formatDateTime(sub.submittedAt) || "방금"}</span>
        <StateBadge sub={sub} showFeedback={showFeedback} />
      </header>
      {sub.text?.trim() && (
        <Collapsible maxHeight={160}>
          <p className="text-base text-ink whitespace-pre-wrap leading-relaxed">{sub.text}</p>
        </Collapsible>
      )}
      <FileChips files={sub.files ?? []} />
    </article>
  );
}

function VersionHistory({ sessionId, submissionId }: { sessionId: string; submissionId: string }) {
  const [versions, setVersions] = useState<SubmissionVersion[] | null>(null);
  useEffect(() => onSubmissionVersions(sessionId, submissionId, setVersions), [sessionId, submissionId]);
  if (!versions) return <p role="status" className="text-sm text-slate-text">이력을 불러오는 중...</p>;
  return (
    <ol className="space-y-2" aria-label="제출 이력" data-testid="submission-history">
      {versions.map((v) => (
        <li key={v.version} className="p-3 rounded-lg border border-silver-mist">
          <p className="text-xs text-slate-text">
            {v.version}번째 제출 · {formatDateTime(v.submittedAt) || "방금"}
          </p>
          {v.text?.trim() && <p className="mt-1 text-sm text-ink whitespace-pre-wrap">{v.text}</p>}
          <div className="mt-1">
            <FileChips files={v.files ?? []} />
          </div>
          {v.feedback && (
            <p className="mt-2 p-2 rounded-md bg-buttercup text-sm text-ink whitespace-pre-wrap">
              <span className="font-semibold text-ochre">강사 피드백 · </span>
              {v.feedback}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function StudentSubmissions({
  sessionId,
  module,
  participantId,
  participantName,
}: {
  sessionId: string;
  module: Module & { id: string };
  participantId: string;
  participantName: string;
}) {
  const [mine, setMine] = useState<Submission | null | undefined>(undefined);
  const [peers, setPeers] = useState<Submission[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => onMySubmission(sessionId, module.id, participantId, setMine), [sessionId, module.id, participantId]);
  // 제출한 뒤에만 같은 실습의 다른 제출물을 읽을 수 있다 (규칙)
  const hasSubmitted = !!mine;
  useEffect(() => {
    if (!hasSubmitted) return;
    return onModuleSubmissions(sessionId, module.id, setPeers);
  }, [sessionId, module.id, hasSubmitted]);

  function addFiles(list: File[]) {
    if (list.length === 0) return;
    const { valid, errors } = validateFiles(list);
    const next = [...files, ...valid].slice(0, MAX_SUBMISSION_FILES);
    setFiles(next);
    setError(
      errors[0] ?? (files.length + valid.length > MAX_SUBMISSION_FILES ? `파일은 최대 ${MAX_SUBMISSION_FILES}개까지 제출할 수 있습니다.` : "")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && files.length === 0) {
      setError("설명을 쓰거나 파일을 하나 이상 첨부해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    const uploaded: SubmissionFile[] = [];
    // 모든 파일이 올라간 뒤에만 제출 기록 — 실패한 파일을 제출로 세지 않는다
    for (const [i, file] of files.entries()) {
      try {
        setProgress(`파일 올리는 중 ${i + 1}/${files.length}`);
        const r = await uploadFile(sessionId, file).promise;
        uploaded.push({ name: r.name, size: r.size, mimeType: r.mimeType, url: r.url });
      } catch {
        setError(`${file.name} 업로드에 실패해 제출하지 않았습니다. 다시 제출해 주세요.`);
        setBusy(false);
        setProgress("");
        return;
      }
    }
    try {
      setProgress("제출 기록 중");
      const version = await submitWork(
        sessionId,
        module.id,
        participantId,
        participantName,
        { text: text.trim(), files: uploaded },
        mine?.version ?? null
      );
      setDone(`제출되었습니다 · ${version}번째 제출`);
      setText("");
      setFiles([]);
    } catch {
      setError("제출하지 못했습니다. 다른 기기에서 먼저 제출했거나 연결이 끊겼을 수 있습니다. 새로고침 후 다시 시도해 주세요.");
    }
    setBusy(false);
    setProgress("");
  }

  const others = peers.filter((p) => p.uid !== participantId);

  return (
    <div className="space-y-5">
      <section aria-labelledby="my-submission-heading" className="p-4 rounded-xl border border-silver-mist bg-chalk-card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="my-submission-heading" className="text-base font-bold text-graphite">
            내 제출 — {module.practiceTitle || module.title}
          </h3>
          {mine !== undefined && <StateBadge sub={mine} />}
        </div>
        {mine && (
          <p className="text-sm text-slate-text">
            마지막 제출 {formatDateTime(mine.submittedAt) || "방금"} · {mine.version}번째 제출
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor="submission-text" className="block text-sm font-semibold text-ink">
            {mine ? "다시 제출할 내용" : "제출할 내용"} <span className="font-normal text-slate-text">(설명·결과 링크 등)</span>
          </label>
          <textarea
            id="submission-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            disabled={busy}
            className="w-full px-3 py-2 text-base text-ink bg-chalk-card border border-field-border rounded-lg outline-none focus:border-graphite resize-y"
          />
          {mine?.text && !text && (
            <button
              type="button"
              onClick={() => setText(mine.text)}
              className="text-sm font-semibold text-blueprint hover:underline cursor-pointer"
            >
              지난 제출 내용 불러오기
            </button>
          )}
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="첨부할 파일">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-vellum border border-silver-mist text-sm">
                  <span className="max-w-[200px] truncate">{f.name}</span>
                  <span className="text-xs text-ash-text">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    aria-label={`${f.name} 빼기`}
                    className="touch-target inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-text hover:text-terracotta cursor-pointer"
                  >
                    <RiCloseLine size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              data-testid="submission-file-input"
              aria-label="제출 파일 선택"
              className="hidden"
              onChange={(e) => {
                // 입력값을 비우기 전에 목록을 복사 (같은 파일을 다시 고를 수 있게 비움)
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                addFiles(picked);
              }}
            />
            <Button type="button" variant="outlined" onClick={() => fileRef.current?.click()} disabled={busy || files.length >= MAX_SUBMISSION_FILES}>
              <RiAttachmentLine size={16} aria-hidden className="mr-1" />
              파일 첨부 ({files.length}/{MAX_SUBMISSION_FILES})
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? progress || "제출 중..." : mine ? `다시 제출하기 (${mine.version + 1}번째)` : "제출하기"}
            </Button>
          </div>
          {done && (
            <p role="status" className="text-sm font-semibold text-sage">
              <RiCheckboxCircleLine size={14} aria-hidden className="inline -mt-0.5 mr-1" />
              {done}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-terracotta">
              {error}
            </p>
          )}
          <p className="text-xs text-slate-text">{SUBMISSION_IDENTITY_NOTICE}</p>
          <p className="text-xs text-slate-text">{SUBMISSION_VISIBILITY_NOTICE}</p>
        </form>

        {mine && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-blueprint">내 제출 이력과 피드백 보기</summary>
            <div className="mt-2">
              <VersionHistory sessionId={sessionId} submissionId={memberDocId(module.id, participantId)} />
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="peer-heading" className="space-y-3">
        <h3 id="peer-heading" className="text-base font-bold text-graphite">
          다른 교육생 제출물 {hasSubmitted ? `(${others.length})` : ""}
        </h3>
        {!hasSubmitted ? (
          <p className="text-sm text-slate-text">이 실습에 제출하면 다른 교육생의 최신 제출물을 볼 수 있습니다.</p>
        ) : others.length === 0 ? (
          <p className="text-sm text-slate-text">아직 다른 제출물이 없습니다.</p>
        ) : (
          <div className="grid xl:grid-cols-2 gap-3" data-testid="peer-submissions">
            {others.map((s) => (
              <SubmissionCard key={s.id} sub={s} moduleTitle={module.title} showFeedback={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FeedbackForm({ sessionId, sub, adminUid }: { sessionId: string; sub: Submission & { id: string }; adminUid: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState("saving");
    try {
      await giveFeedback(sessionId, sub, sub.version, text.trim(), adminUid);
      setText("");
      setState("saved");
    } catch {
      setState("error");
    }
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor={`feedback-${sub.id}`} className="block text-sm font-semibold text-ink">
        {sub.version}번째 제출에 피드백
      </label>
      <textarea
        id={`feedback-${sub.id}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (state !== "saving") setState("idle");
        }}
        rows={3}
        className="w-full px-3 py-2 text-base text-ink bg-chalk-card border border-field-border rounded-lg outline-none focus:border-graphite resize-y"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={state === "saving" || !text.trim()}>
          {state === "saving" ? "저장 중..." : "피드백 저장"}
        </Button>
        {state === "saved" && <span role="status" className="text-sm text-sage font-semibold">저장했습니다</span>}
        {state === "error" && <span role="alert" className="text-sm text-terracotta">저장하지 못했습니다. 다시 시도해주세요.</span>}
      </div>
    </form>
  );
}

/** 강사용 실습별 제출 현황 — 진행 화면(P2-03)에서도 사용 */
export function InstructorSubmissions({
  sessionId,
  module,
  learners,
  adminUid,
}: {
  sessionId: string;
  module: Module & { id: string };
  learners: Participant[];
  adminUid: string;
}) {
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => onModuleSubmissions(sessionId, module.id, setSubs), [sessionId, module.id]);

  if (!subs) return <p role="status" className="text-sm text-slate-text">제출 현황을 불러오는 중...</p>;

  const summary = summarizeSubmissions(subs, module.id, learners.map((l) => l.id!).filter(Boolean));
  const byUid = new Map(subs.map((s) => [s.uid, s]));
  // 미제출을 먼저, 그다음 피드백 대기, 피드백 완료 순
  const rows = [...learners].sort((a, b) => {
    const rank = (p: Participant) => {
      const s = p.id ? byUid.get(p.id) : undefined;
      return !s ? 0 : isReviewed(s) ? 2 : 1;
    };
    return rank(a) - rank(b);
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink" title={SUBMISSION_SUMMARY_HELP} data-testid="submission-summary">
        제출 {summary.submitted} · 재제출 {summary.resubmitted} · <span className="font-semibold text-warn">미제출 {summary.notSubmitted}</span> · 피드백 완료{" "}
        {summary.reviewed}
      </p>
      <p className="text-xs text-slate-text">{SUBMISSION_SUMMARY_HELP}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-text">아직 입장한 교육생이 없습니다.</p>
      ) : (
        <ul className="space-y-2" data-testid="instructor-submissions">
          {rows.map((p) => {
            const s = p.id ? byUid.get(p.id) : undefined;
            const open = !!s && openId === s.id;
            return (
              <li key={p.id} className="rounded-lg border border-silver-mist">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="text-sm font-semibold text-ink">{p.name}</span>
                  <StateBadge sub={s ?? null} />
                  {s && <span className="text-xs text-ash-text">{formatDateTime(s.submittedAt)}</span>}
                  {s && (
                    <button
                      onClick={() => setOpenId(open ? null : s.id!)}
                      aria-expanded={open}
                      className="ml-auto touch-target inline-flex items-center h-8 px-3 rounded-full border border-silver-mist text-sm font-semibold text-ink hover:border-graphite cursor-pointer"
                    >
                      {open ? "접기" : "보기·피드백"}
                    </button>
                  )}
                </div>
                {open && s && (
                  <div className="px-3 pb-3 space-y-3">
                    <SubmissionCard sub={s} moduleTitle={module.title} />
                    <FeedbackForm sessionId={sessionId} sub={s as Submission & { id: string }} adminUid={adminUid} />
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-blueprint">제출 이력 ({s.version}회)</summary>
                      <div className="mt-2">
                        <VersionHistory sessionId={sessionId} submissionId={s.id!} />
                      </div>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 제출 탭 (P2-01) */
export default function SubmissionsView({
  sessionId,
  isAdmin,
  modules,
  activeModuleId,
  participantId,
  participantName,
  learners,
}: SubmissionsViewProps) {
  const openModules = modules.filter((m) => m.id && m.submissionEnabled) as (Module & { id: string })[];
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId =
    picked && openModules.some((m) => m.id === picked)
      ? picked
      : openModules.find((m) => m.id === activeModuleId)?.id ?? openModules[0]?.id ?? null;
  const selected = openModules.find((m) => m.id === selectedId) ?? null;

  if (!selected) {
    return (
      <div className="p-12 text-center text-slate-text">
        {isAdmin
          ? "제출함이 켜진 실습이 없습니다. 실습 안내 편집에서 ‘앱 안 제출함 열기’를 선택하세요."
          : "지금은 제출을 받는 실습이 없습니다."}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {openModules.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-ink">
          실습 선택
          <select value={selected.id} onChange={(e) => setPicked(e.target.value)} aria-label="제출 실습 선택" className={control}>
            {openModules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} — {m.practiceTitle}
                {m.id === activeModuleId ? " (현재 실습)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {selected.submitUrl && isSafeExternalUrl(selected.submitUrl) && (
        <p className="text-sm text-slate-text">
          외부 제출 링크도 있습니다:{" "}
          <a href={selected.submitUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blueprint hover:underline">
            <RiExternalLinkLine size={14} aria-hidden className="inline -mt-0.5" /> 제출 링크 열기
          </a>
        </p>
      )}
      {isAdmin ? (
        <InstructorSubmissions sessionId={sessionId} module={selected} learners={learners} adminUid={participantId} />
      ) : (
        <StudentSubmissions sessionId={sessionId} module={selected} participantId={participantId} participantName={participantName} />
      )}
    </div>
  );
}
