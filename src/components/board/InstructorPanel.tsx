"use client";

import { useState } from "react";
import { Participant } from "@/lib/firestore";
import {
  HELP_STATUS_LABEL,
  HelpRequest,
  Module,
  pendingHelp,
  Progress,
  PROGRESS_HELP,
  PROGRESS_LABEL,
  ProgressSummary,
} from "@/lib/practice";
import { acknowledgeHelp, resolveHelp } from "@/lib/classroom";
import { formatTime } from "@/lib/format";
import { UNANSWERED_HELP } from "@/lib/question";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { RiHandHeartLine, RiQuestionLine, RiCheckboxCircleLine, RiArrowDownSLine, RiArrowUpSLine, RiBarChartBoxLine } from "react-icons/ri";

interface SummaryProps {
  sessionId: string;
  helpCount: number;
  unansweredCount: number;
  summary: ProgressSummary | null;
  onOpenDetails: () => void;
  onShowUnanswered: () => void;
}

const chip =
  "touch-target inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold border cursor-pointer transition-colors";

/** 강사 진행 요약 (요구사항 4.2) — 보드 상단 보조 영역, 좁은 화면에서는 접을 수 있음 */
export function InstructorSummary({ sessionId, helpCount, unansweredCount, summary, onOpenDetails, onShowUnanswered }: SummaryProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section
      aria-label="진행 요약"
      data-testid="instructor-summary"
      className="px-4 py-2 border-b border-silver-mist bg-chalk-card flex flex-wrap items-center gap-2"
    >
      <span className="inline-flex items-center gap-1 text-sm font-bold text-graphite">
        <RiBarChartBoxLine size={16} aria-hidden />
        진행 요약
      </span>
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "진행 요약 펼치기" : "진행 요약 접기"}
        className="touch-target sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-text cursor-pointer"
      >
        {collapsed ? <RiArrowDownSLine size={18} aria-hidden /> : <RiArrowUpSLine size={18} aria-hidden />}
      </button>
      <div className={`${collapsed ? "hidden" : "flex"} sm:flex flex-wrap items-center gap-2 basis-full sm:basis-auto`}>
        <button
          onClick={onOpenDetails}
          className={`${chip} ${helpCount > 0 ? "bg-warn text-chalk-card border-warn" : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"}`}
        >
          <RiHandHeartLine size={16} aria-hidden />
          도움 요청 {helpCount}
        </button>
        <button
          onClick={onShowUnanswered}
          title={UNANSWERED_HELP}
          className={`${chip} bg-chalk-card text-ink border-silver-mist hover:border-graphite`}
        >
          <RiQuestionLine size={16} aria-hidden />
          미답변 질문 {unansweredCount}
        </button>
        {summary ? (
          <button
            onClick={onOpenDetails}
            title={PROGRESS_HELP}
            className={`${chip} bg-chalk-card text-ink border-silver-mist hover:border-graphite`}
          >
            <RiCheckboxCircleLine size={16} aria-hidden />
            완료 {summary.done} · 진행 중 {summary.doing} · 응답 없음 {summary.noResponse}
          </button>
        ) : (
          <span className="text-sm text-slate-text">현재 실습이 없어 진행 집계가 없습니다.</span>
        )}
        <a
          href={`/board/${sessionId}/instructor`}
          target="_blank"
          rel="noopener noreferrer"
          className="touch-target inline-flex items-center h-9 px-2 text-sm font-semibold text-blueprint hover:underline whitespace-nowrap"
        >
          강사 진행 화면
        </a>
      </div>
    </section>
  );
}

/** 처리할 도움 요청 목록 — 요청자 이름은 강사 화면에만 (진행 현황 창·강사 진행 화면 공용) */
export function HelpRequestList({
  sessionId,
  adminUid,
  helpRequests,
  modules,
  moduleId,
}: {
  sessionId: string;
  adminUid: string;
  helpRequests: (HelpRequest & { id: string })[];
  modules: Module[];
  /** 지정하면 그 실습의 요청만 */
  moduleId?: string | null;
}) {
  const [error, setError] = useState("");
  const pending = pendingHelp(helpRequests, moduleId);
  const moduleTitle = (id: string) => modules.find((m) => m.id === id)?.title ?? "삭제된 실습";

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch {
      setError("처리하지 못했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-2 text-sm text-terracotta">
          {error}
        </p>
      )}
      {pending.length === 0 ? (
        <p className="text-sm text-slate-text">처리할 도움 요청이 없습니다.</p>
      ) : (
        <ul className="space-y-2" data-testid="help-list">
          {pending.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-warn/30 bg-warn-bg">
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-ink">{h.name}</p>
                <p className="text-sm text-slate-text">
                  {moduleTitle(h.moduleId)} · {formatTime(h.requestedAt) || "방금"} 요청 · {HELP_STATUS_LABEL[h.status]}
                </p>
              </div>
              {h.status === "open" && (
                <Button variant="outlined" onClick={() => run(() => acknowledgeHelp(sessionId, h.id))}>
                  확인
                </Button>
              )}
              <Button onClick={() => run(() => resolveHelp(sessionId, h.id, adminUid))}>처리 완료</Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-text">
        처리 완료는 도움 요청만 닫습니다. 교육생의 실습 완료 여부는 교육생이 직접 고른 값 그대로입니다.
      </p>
    </div>
  );
}

/** 교육생별 진행 상태 (강사·관리자 계정 제외) */
export function ProgressList({ module, progress, learners }: { module: Module | null; progress: Progress[]; learners: Participant[] }) {
  const statusOf = (uid: string) => progress.find((p) => p.uid === uid && p.moduleId === module?.id)?.status ?? null;
  return (
    <div>
      {!module ? (
        <p className="text-sm text-slate-text">현재 실습을 지정하면 교육생별 진행 상태가 여기 표시됩니다.</p>
      ) : learners.length === 0 ? (
        <p className="text-sm text-slate-text">아직 입장한 교육생이 없습니다.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-1" data-testid="progress-list">
          {learners.map((p) => {
            const st = p.id ? statusOf(p.id) : null;
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-silver-mist">
                <span className="truncate text-sm text-ink">{p.name}</span>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                    st === "done" ? "bg-ok-bg text-sage" : st === "doing" ? "bg-buttercup text-ochre" : "bg-vellum text-slate-text"
                  }`}
                >
                  {st ? PROGRESS_LABEL[st] : "응답 없음"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-text">{PROGRESS_HELP} 강사·관리자 계정은 집계에서 뺍니다.</p>
    </div>
  );
}

interface PanelProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  adminUid: string;
  helpRequests: (HelpRequest & { id: string })[];
  modules: Module[];
  activeModule: Module | null;
  progress: Progress[];
  /** 교육생 목록 (강사 본인·세션 소유자 제외) */
  learners: Participant[];
}

/** 진행 현황 상세 (보드 위 빠른 보기) — 전체는 강사 진행 화면 */
export function InstructorPanelModal({ open, onClose, sessionId, adminUid, helpRequests, modules, activeModule, progress, learners }: PanelProps) {
  const pendingCount = pendingHelp(helpRequests).length;
  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl max-h-[90vh] flex flex-col" labelledBy="instructor-panel-title">
      <div className="px-6 pb-6 overflow-y-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="instructor-panel-title" className="text-2xl font-bold text-graphite">
            진행 현황
          </h2>
          <a
            href={`/board/${sessionId}/instructor`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-blueprint hover:underline"
          >
            강사 진행 화면 열기 (새 창)
          </a>
        </div>

        <section aria-labelledby="help-heading">
          <h3 id="help-heading" className="text-base font-bold text-ink mb-2">
            처리할 도움 요청 ({pendingCount})
          </h3>
          <HelpRequestList sessionId={sessionId} adminUid={adminUid} helpRequests={helpRequests} modules={modules} />
        </section>

        <section aria-labelledby="progress-heading">
          <h3 id="progress-heading" className="text-base font-bold text-ink mb-2">
            현재 실습 진행 {activeModule ? `— ${activeModule.title} · ${activeModule.practiceTitle}` : ""}
          </h3>
          <ProgressList module={activeModule} progress={progress} learners={learners} />
        </section>
      </div>
    </Modal>
  );
}
