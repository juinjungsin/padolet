"use client";

import { useState } from "react";
import { Post } from "@/lib/firestore";
import {
  formatDue,
  HelpRequest,
  Module,
  Progress,
  ProgressStatus,
  PROGRESS_HELP,
  summarizeProgress,
} from "@/lib/practice";
import { cancelHelp, requestHelp, setMyProgress } from "@/lib/classroom";
import { isSafeExternalUrl } from "@/lib/url-safe";
import Collapsible from "@/components/ui/Collapsible";
import {
  RiFlagLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiEditLine,
  RiExternalLinkLine,
  RiTimeLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiHandHeartLine,
  RiQuestionLine,
  RiUploadCloud2Line,
} from "react-icons/ri";

interface GuideBannerProps {
  sessionId: string;
  isAdmin: boolean;
  module: Module | null;
  posts: Post[] | null;
  /** 현재 실습의 진행 상태 목록 (이름 없음) */
  progress: Progress[];
  /** 내 도움 요청 (교육생) */
  myHelp: HelpRequest | null;
  participantId: string;
  participantName: string;
  participantCount: number;
  onAskQuestion: () => void;
  onEdit: () => void;
}

const actionButton =
  "touch-target inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold border transition-colors cursor-pointer disabled:opacity-50";

/** 현재 실습 안내 (P1-01) + 교육생 주요 행동 (P1-04) — 보드 상단 고정 */
export default function GuideBanner({
  sessionId,
  isAdmin,
  module,
  posts,
  progress,
  myHelp,
  participantId,
  participantName,
  participantCount,
  onAskQuestion,
  onEdit,
}: GuideBannerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!module?.id) {
    return (
      <section aria-label="현재 실습 안내" className="px-4 py-3 border-b border-silver-mist bg-chalk-card flex flex-wrap items-center gap-2">
        <RiFlagLine size={18} aria-hidden className="text-slate-text" />
        <p className="text-sm text-slate-text flex-1 min-w-0">
          {isAdmin ? "아직 현재 실습을 지정하지 않았습니다." : "지금은 진행 중인 실습 안내가 없습니다."}
        </p>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="touch-target inline-flex items-center gap-1 h-9 px-3 rounded-full border border-graphite text-graphite text-sm font-semibold hover:bg-vellum cursor-pointer"
          >
            <RiEditLine size={16} aria-hidden />
            실습 안내 만들기
          </button>
        )}
      </section>
    );
  }

  const moduleId = module.id;
  const mine = progress.find((p) => p.uid === participantId && p.moduleId === moduleId)?.status ?? null;
  const summary = summarizeProgress(progress, moduleId, participantCount);
  const helpActive = myHelp?.moduleId === moduleId && (myHelp.status === "open" || myHelp.status === "acknowledged");
  const materials = (posts ?? []).filter((p) => p.id && module.materialPostIds?.includes(p.id));
  const due = formatDue(module.dueAt);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch {
      setError("저장하지 못했습니다. 연결 상태를 확인하고 다시 눌러 주세요.");
    }
    setBusy(false);
  }

  // 같은 상태를 다시 누르면 선택 취소
  const chooseProgress = (status: ProgressStatus) =>
    run(() => setMyProgress(sessionId, moduleId, participantId, mine === status ? null : status));

  const toggleHelp = () =>
    run(() =>
      helpActive
        ? cancelHelp(sessionId, moduleId, participantId)
        : requestHelp(sessionId, moduleId, participantId, participantName, !!myHelp && myHelp.moduleId === moduleId)
    );

  return (
    <section
      aria-label="현재 실습 안내"
      data-testid="guide-banner"
      className="px-4 py-3 border-b border-silver-mist bg-buttercup"
    >
      <div className="flex items-start gap-2">
        <RiFlagLine size={18} aria-hidden className="shrink-0 mt-1 text-ochre" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ochre">현재 실습 · {module.title}</p>
          <h2 className="text-lg font-bold text-graphite">{module.practiceTitle || module.title}</h2>
        </div>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="touch-target shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-full border border-ochre/40 text-ochre text-sm font-semibold hover:bg-chalk-card cursor-pointer"
          >
            <RiEditLine size={16} aria-hidden />
            <span className="hidden sm:inline">실습 안내 편집</span>
            <span className="sm:hidden">편집</span>
          </button>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "실습 안내 펼치기" : "실습 안내 접기"}
          className="touch-target shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-ochre hover:bg-chalk-card cursor-pointer"
        >
          {collapsed ? <RiArrowDownSLine size={20} aria-hidden /> : <RiArrowUpSLine size={20} aria-hidden />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2 pl-6 space-y-2">
          {module.description?.trim() && (
            <Collapsible maxHeight={96}>
              <p className="text-base text-ink whitespace-pre-wrap leading-relaxed">{module.description}</p>
            </Collapsible>
          )}

          {(module.links?.length > 0 || materials.length > 0) && (
            <ul className="flex flex-wrap gap-2" aria-label="필요한 자료">
              {module.links
                ?.filter((l) => isSafeExternalUrl(l.url))
                .map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="touch-target inline-flex items-center gap-1 h-8 px-3 rounded-full bg-chalk-card border border-silver-mist text-sm font-semibold text-blueprint hover:border-blueprint"
                    >
                      <RiExternalLinkLine size={14} aria-hidden />
                      {l.label || l.url}
                    </a>
                  </li>
                ))}
              {materials.map((p) => {
                const url = p.type === "link" ? p.content : p.fileUrl;
                const label = p.title || p.fileMeta?.name || p.content.split("\n")[0];
                return (
                  <li key={p.id}>
                    {url && isSafeExternalUrl(url) ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="touch-target inline-flex items-center gap-1 h-8 px-3 rounded-full bg-chalk-card border border-silver-mist text-sm font-semibold text-blueprint hover:border-blueprint max-w-[280px]"
                      >
                        <RiExternalLinkLine size={14} aria-hidden className="shrink-0" />
                        <span className="truncate">{label}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center h-8 px-3 rounded-full bg-chalk-card border border-silver-mist text-sm text-ink max-w-[280px] truncate">
                        자료: {label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {(due || module.submitUrl) && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
              {due && (
                <span className="inline-flex items-center gap-1">
                  <RiTimeLine size={16} aria-hidden />
                  마감 {due}
                </span>
              )}
              {module.submitUrl && isSafeExternalUrl(module.submitUrl) && (
                <a
                  href={module.submitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blueprint hover:underline"
                >
                  <RiUploadCloud2Line size={16} aria-hidden />
                  제출 링크 열기
                </a>
              )}
            </p>
          )}

          <p className="text-sm text-slate-text" title={PROGRESS_HELP}>
            완료 {summary.done}명 · 진행 중 {summary.doing}명
            {isAdmin && ` · 응답 없음 ${summary.noResponse}명`}
          </p>
        </div>
      )}

      {!isAdmin && (
        <div className="mt-3 pl-6 flex flex-wrap items-center gap-2" role="group" aria-label="실습 진행 행동">
          <button
            onClick={() => chooseProgress("doing")}
            disabled={busy}
            aria-pressed={mine === "doing"}
            className={`${actionButton} ${
              mine === "doing" ? "bg-graphite text-chalk-card border-graphite" : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
            }`}
          >
            <RiLoader4Line size={16} aria-hidden />
            진행 중
          </button>
          <button
            onClick={() => chooseProgress("done")}
            disabled={busy}
            aria-pressed={mine === "done"}
            className={`${actionButton} ${
              mine === "done" ? "bg-sage text-chalk-card border-sage" : "bg-chalk-card text-ink border-silver-mist hover:border-sage"
            }`}
          >
            <RiCheckboxCircleLine size={16} aria-hidden />
            실습 완료
          </button>
          <button
            onClick={toggleHelp}
            disabled={busy}
            aria-pressed={helpActive}
            className={`${actionButton} ${
              helpActive ? "bg-warn text-chalk-card border-warn" : "bg-chalk-card text-warn border-warn/40 hover:border-warn"
            }`}
          >
            <RiHandHeartLine size={16} aria-hidden />
            {helpActive ? "도움 요청 취소" : "도움 필요"}
          </button>
          <button
            onClick={onAskQuestion}
            className={`${actionButton} bg-chalk-card text-ink border-silver-mist hover:border-graphite`}
          >
            <RiQuestionLine size={16} aria-hidden />
            질문하기
          </button>
          {myHelp?.moduleId === moduleId && myHelp.status !== "cancelled" && (
            <p role="status" className="basis-full text-sm text-warn">
              {myHelp.status === "open"
                ? "도움 요청을 보냈습니다. 강사가 확인하면 알려 드립니다."
                : myHelp.status === "acknowledged"
                  ? "강사가 도움 요청을 확인했습니다. 잠시만 기다려 주세요."
                  : "도움 요청이 처리되었습니다. 또 필요하면 다시 눌러 주세요."}
            </p>
          )}
          {error && (
            <p role="alert" className="basis-full text-sm text-terracotta">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
