"use client";

import { Ref, useEffect, useImperativeHandle, useState, useRef } from "react";
import {
  addPost,
  containsBannedWord,
  isNameBlocked,
  POST_COLORS,
  Post,
  PostColor,
  PostKind,
} from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { POST_KINDS } from "@/lib/post-kind";
import { findLocalPath, LOCAL_PATH_NOTICE } from "@/lib/local-path";
import { uploadFile, validateFiles } from "@/lib/storage";
import Button from "@/components/ui/Button";
import { RiAttachmentLine, RiRefreshLine } from "react-icons/ri";

/** 보드 화면에서 입력 카드를 특정 유형으로 펼칠 때 사용 (예: 실습 안내의 '질문하기') */
export interface PostInputHandle {
  open: (kind?: PostKind) => void;
}

interface PostInputProps {
  ref?: Ref<PostInputHandle>;
  /** 현재 실습 모듈 — 새 게시물에 함께 기록 (모듈 필터용) */
  moduleId?: string | null;
  sessionId: string;
  authorId: string;
  authorName: string;
  currentPostCount: number;
  /** 세션 관리자 — 공지 작성 가능, 게시물에 강사 표시 */
  isAdmin?: boolean;
  bannedWords?: string[];
  blockedNames?: string[];
  /** 보드 잠금 (참여자 기준) — true면 작성 불가 */
  locked?: boolean;
}

const PLACEHOLDER: Record<PostKind, string> = {
  general: "포스트잇에 내용을 작성하세요",
  question: "궁금한 점을 적어 주세요",
  material: "자료 설명 (선택) — 파일을 첨부하거나 링크를 붙여 넣으세요",
  prompt: "복사해서 쓸 프롬프트 본문을 붙여 넣으세요 (줄바꿈·서식 그대로 유지)",
  notice: "교육생에게 알릴 내용과 필요한 행동을 적어 주세요",
};

export default function PostInput({
  ref,
  moduleId = null,
  sessionId,
  authorId,
  authorName,
  currentPostCount,
  isAdmin = false,
  bannedWords = [],
  blockedNames = [],
  locked = false,
}: PostInputProps) {
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<PostKind>("general");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  // 업로드에 실패해 게시되지 않은 파일 — 이것만 다시 시도 (성공한 파일은 중복 게시하지 않음)
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [color, setColor] = useState<PostColor>("yellow");
  // 평소에는 한 줄로 접어 두어 좁은 화면에서도 게시물이 먼저 보이게 한다
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 로컬 경로 안내 후 '그대로 게시'를 고른 본문 (본문이 바뀌면 다시 안내)
  const [pathConfirmedFor, setPathConfirmedFor] = useState<string | null>(null);
  const localPath = findLocalPath(`${title}\n${purpose}\n${content}`);
  const needsPathConfirm = !!localPath && pathConfirmedFor !== content;
  const [showPathNotice, setShowPathNotice] = useState(false);

  useEffect(() => {
    if (expanded) textareaRef.current?.focus();
  }, [expanded]);

  useImperativeHandle(ref, () => ({
    open(nextKind?: PostKind) {
      if (nextKind) setKind(nextKind);
      setExpanded(true);
      // 이미 펼쳐져 있으면 effect가 다시 돌지 않으므로 직접 포커스
      textareaRef.current?.focus();
    },
  }));

  const blocked = isNameBlocked(authorName, blockedNames);
  const disabled = blocked || locked;
  const kinds = POST_KINDS.filter((k) => !k.adminOnly || isAdmin);
  const hasTitle = kind === "material" || kind === "prompt";

  /** 유형별 공통 필드 — Firestore는 undefined 값을 거부하므로 값이 있을 때만 넣는다 */
  function basePayload(): Partial<Post> {
    const p: Partial<Post> = {
      authorId,
      authorName,
      authorRole: isAdmin ? "admin" : "participant",
      kind,
      isQuestion: kind === "question",
      color,
    };
    if (hasTitle && title.trim()) p.title = title.trim();
    if (kind === "prompt" && purpose.trim()) p.purpose = purpose.trim();
    if (moduleId) p.moduleId = moduleId;
    if (kind === "question") {
      p.questionStatus = "open";
      p.meToo = [];
    }
    return p;
  }

  function resetFields() {
    setContent("");
    setTitle("");
    setPurpose("");
    setKind("general");
  }

  function checkCanPost(text: string): boolean {
    if (locked) {
      setError("보드가 잠금 상태입니다. 열람만 가능합니다.");
      return false;
    }
    if (blocked) {
      setError("관리자에 의해 차단된 사용자입니다.");
      return false;
    }
    const hit = containsBannedWord(text, bannedWords);
    if (hit) {
      setError(`금칙어 "${hit}" 가 포함되어 게시할 수 없습니다.`);
      return false;
    }
    setError("");
    return true;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!content.trim()) return;
    if (!checkCanPost(`${title} ${purpose} ${content}`)) return;
    // 내 컴퓨터 경로는 다른 사람이 열 수 없다 — 첨부를 권하고, 그래도 원하면 게시 (P1-06)
    if (needsPathConfirm) {
      setShowPathNotice(true);
      return;
    }
    await publishText();
  }

  /** 로컬 경로 안내에서 '그대로 게시'를 고른 경우 */
  async function submitConfirmed() {
    if (!content.trim() || !checkCanPost(`${title} ${purpose} ${content}`)) return;
    await publishText();
  }

  async function publishText() {
    setLoading(true);
    const urlPattern = /^https?:\/\/\S+$/i;
    // 프롬프트는 URL 한 줄이어도 본문 그대로 (서식 유지)
    const type = kind !== "prompt" && urlPattern.test(content.trim()) ? "link" : "text";

    try {
      await addPost(sessionId, {
        ...basePayload(),
        // 프롬프트는 앞뒤 공백·줄바꿈까지 원문 그대로 보존 (복사 결과가 원문과 일치해야 함)
        content: kind === "prompt" ? content : content.trim(),
        type,
        gridIndex: currentPostCount,
      } as Omit<Post, "id" | "createdAt">);
      resetFields();
    } catch {
      // 입력 내용은 지우지 않아 다시 시도할 수 있게 둔다
      setError("게시에 실패했습니다. 연결 상태를 확인하고 다시 시도해주세요.");
    }
    setLoading(false);
  }

  async function uploadAndPost(files: File[]) {
    setLoading(true);
    setUploadProgress(0);
    setFailedFiles([]);
    let captionUsed = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { promise } = uploadFile(sessionId, file, (p) => setUploadProgress(p.progress));
        const result = await promise;
        const base = basePayload();
        // 입력창 텍스트·제목은 첫 파일에만 붙임 (여러 장 업로드 시 중복 방지)
        if (captionUsed) {
          delete base.title;
          delete base.purpose;
        }
        await addPost(sessionId, {
          ...base,
          content: captionUsed ? "" : content.trim(),
          type: file.type.startsWith("image/") ? "image" : "file",
          fileUrl: result.url,
          fileMeta: { name: result.name, size: result.size, mimeType: result.mimeType },
          gridIndex: currentPostCount + i,
        } as Omit<Post, "id" | "createdAt">);
        captionUsed = true;
      } catch {
        const remaining = files.slice(i);
        setFailedFiles(remaining);
        setError(
          `${file.name} 업로드에 실패했습니다.` +
            (remaining.length > 1 ? ` 이 파일을 포함해 ${remaining.length}개가 게시되지 않았습니다.` : "")
        );
        break;
      }
    }
    if (captionUsed) resetFields();
    setLoading(false);
    setUploadProgress(0);
  }

  // 이미지 + 일반 파일 업로드 — 대화창과 동일한 검증(위험 형식 차단, 50MB 제한) 적용
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || disabled) return;
    if (!checkCanPost(`${title} ${purpose} ${content}`)) {
      e.target.value = "";
      return;
    }

    // SVG/스크립트/실행파일 등 위험한 형식 차단
    const { valid, errors } = validateFiles(Array.from(files));
    e.target.value = "";
    if (errors.length > 0) setError(errors[0]);
    if (valid.length === 0) return;
    await uploadAndPost(valid);
  }

  const fileInput = (
    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
  );

  if (!expanded && !content && !loading && !error) {
    return (
      <form onSubmit={(e) => e.preventDefault()} className="px-4 py-3 border-b border-silver-mist bg-parchment">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            disabled={disabled}
            aria-expanded={false}
            className="touch-target flex-1 min-w-0 h-11 px-4 text-left text-base text-ash-text bg-chalk-card border border-field-border rounded-xl hover:border-graphite cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 truncate"
          >
            {locked
              ? "보드가 잠금 상태입니다 — 열람만 가능합니다"
              : blocked
                ? "관리자에 의해 차단된 사용자입니다"
                : "포스트잇 남기기 — 질문·자료·프롬프트도 올릴 수 있어요"}
          </button>
          {fileInput}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="파일 첨부 (이미지/문서/오디오/비디오, 최대 50MB)"
            aria-label="파일 첨부 (최대 50MB)"
            className="touch-target shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl border border-silver-mist bg-chalk-card text-slate-text hover:text-graphite cursor-pointer disabled:opacity-50"
          >
            <RiAttachmentLine size={18} aria-hidden />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-silver-mist bg-parchment">
      <div className="bg-chalk-card border border-silver-mist rounded-xl p-3 sm:p-4 shadow-[--shadow-card] focus-within:border-graphite transition-colors">
        <div role="radiogroup" aria-label="게시물 유형" className="flex flex-wrap gap-1.5 mb-2">
          {kinds.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              disabled={disabled}
              onClick={() => setKind(k.key)}
              className={`touch-target inline-flex items-center h-8 px-3 rounded-full text-sm font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                kind === k.key
                  ? "bg-graphite text-chalk-card border-graphite"
                  : "bg-chalk-card text-slate-text border-silver-mist hover:border-graphite"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {hasTitle && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={disabled}
            aria-label={kind === "prompt" ? "프롬프트 제목" : "자료 제목 (선택)"}
            placeholder={kind === "prompt" ? "프롬프트 제목 (예: 회의록 요약)" : "자료 제목 (선택 — 비우면 파일명 표시)"}
            className="w-full h-10 mb-2 px-3 text-base font-semibold text-ink bg-chalk-card border border-field-border rounded-lg outline-none focus:border-graphite"
          />
        )}
        {kind === "prompt" && (
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={200}
            disabled={disabled}
            aria-label="사용 목적 (선택)"
            placeholder="사용 목적 (선택 — 언제 쓰는 프롬프트인지)"
            className="w-full h-10 mb-2 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-lg outline-none focus:border-graphite"
          />
        )}

        <label htmlFor={`post-input-${sessionId}`} className="sr-only">
          포스트잇 내용
        </label>
        <textarea
          id={`post-input-${sessionId}`}
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError("");
          }}
          placeholder={
            locked
              ? "보드가 잠금 상태입니다 — 열람만 가능합니다"
              : blocked
                ? "관리자에 의해 차단된 사용자입니다"
                : PLACEHOLDER[kind]
          }
          rows={kind === "prompt" ? 5 : 3}
          disabled={disabled}
          className={`w-full resize-y bg-transparent text-ink placeholder:text-ash-text outline-none disabled:opacity-60 ${
            kind === "prompt" ? "font-mono text-sm" : "text-base"
          }`}
        />
        {uploadProgress > 0 && (
          <div
            role="progressbar"
            aria-label="파일 업로드 진행률"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-1 h-1.5 bg-linen rounded-full overflow-hidden"
          >
            <div className="h-full bg-graphite transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Button type="submit" disabled={loading || !content.trim() || disabled}>
            {loading ? (uploadProgress > 0 ? `업로드 중 ${uploadProgress}%` : "게시 중...") : "게시"}
          </Button>
          {fileInput}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || disabled}
            title="파일 첨부 (이미지/문서/오디오/비디오, 최대 50MB)"
            aria-label="파일 첨부 (최대 50MB)"
            className="touch-target inline-flex items-center justify-center w-9 h-9 rounded-full text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer disabled:opacity-50"
          >
            <RiAttachmentLine size={18} aria-hidden />
          </button>

          {/* 색상 태그 선택 */}
          <div className="flex items-center" role="radiogroup" aria-label="포스트잇 색상">
            {POST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                onClick={() => setColor(c)}
                title={POST_COLOR_STYLES[c].label}
                aria-label={`${POST_COLOR_STYLES[c].label} 포스트잇`}
                className="touch-target inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
              >
                <span
                  aria-hidden
                  className={`block w-4 h-4 rounded-full border-2 transition-transform ${
                    color === c ? "border-graphite scale-125" : "border-transparent"
                  }`}
                  style={{ backgroundColor: POST_COLOR_STYLES[c].dot }}
                />
              </button>
            ))}
          </div>

          <span className="text-xs text-ash-text ml-auto" aria-label={`${content.length}자`}>
            {content.length}
          </span>
          {!content && !loading && (
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError("");
              }}
              className="touch-target inline-flex items-center h-8 px-3 rounded-full text-sm text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer"
            >
              접기
            </button>
          )}
        </div>
        {showPathNotice && needsPathConfirm && (
          <div role="alert" data-testid="local-path-notice" className="mt-2 p-3 rounded-lg border border-warn/30 bg-warn-bg text-sm text-warn">
            <p className="font-semibold">{LOCAL_PATH_NOTICE}</p>
            <p className="mt-0.5 text-ink break-all">감지된 경로: {localPath}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="touch-target inline-flex items-center gap-1 h-9 px-3 rounded-full bg-graphite text-chalk-card font-semibold cursor-pointer"
              >
                <RiAttachmentLine size={14} aria-hidden />
                파일 첨부하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setPathConfirmedFor(content);
                  setShowPathNotice(false);
                  // 상태 반영 전이므로 확인 플래그 대신 직접 게시
                  submitConfirmed();
                }}
                className="touch-target inline-flex items-center h-9 px-3 rounded-full border border-warn/40 font-semibold text-warn hover:bg-chalk-card cursor-pointer"
              >
                그대로 게시
              </button>
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-terracotta">
            <span>{error}</span>
            {failedFiles.length > 0 && !loading && (
              <button
                type="button"
                onClick={() => uploadAndPost(failedFiles)}
                className="touch-target inline-flex items-center gap-1 h-8 px-3 rounded-full border border-terracotta/40 font-semibold hover:bg-warn-bg cursor-pointer"
              >
                <RiRefreshLine size={14} aria-hidden />
                실패한 파일 다시 시도
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
