"use client";

import { useState, useRef } from "react";
import {
  addPost,
  containsBannedWord,
  isNameBlocked,
  POST_COLORS,
  PostColor,
} from "@/lib/firestore";
import { POST_COLOR_STYLES } from "@/lib/post-colors";
import { uploadFile, validateFiles } from "@/lib/storage";
import Button from "@/components/ui/Button";
import { RiAttachmentLine, RiQuestionLine } from "react-icons/ri";

interface PostInputProps {
  sessionId: string;
  authorId: string;
  authorName: string;
  currentPostCount: number;
  bannedWords?: string[];
  blockedNames?: string[];
  /** 보드 잠금 (참여자 기준) — true면 작성 불가 */
  locked?: boolean;
}

export default function PostInput({
  sessionId,
  authorId,
  authorName,
  currentPostCount,
  bannedWords = [],
  blockedNames = [],
  locked = false,
}: PostInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [color, setColor] = useState<PostColor>("yellow");
  const [isQuestion, setIsQuestion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blocked = isNameBlocked(authorName, blockedNames);
  const disabled = blocked || locked;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    if (locked) {
      setError("보드가 잠금 상태입니다. 열람만 가능합니다.");
      return;
    }
    if (blocked) {
      setError("관리자에 의해 차단된 사용자입니다.");
      return;
    }
    const hit = containsBannedWord(content, bannedWords);
    if (hit) {
      setError(`금칙어 "${hit}" 가 포함되어 게시할 수 없습니다.`);
      return;
    }
    setError("");

    setLoading(true);

    const urlPattern = /^https?:\/\/\S+$/i;
    const type = urlPattern.test(content.trim()) ? "link" : "text";

    await addPost(sessionId, {
      authorId,
      authorName,
      content: content.trim(),
      type,
      gridIndex: currentPostCount,
      color,
      isQuestion,
    });

    setContent("");
    setIsQuestion(false);
    setLoading(false);
  }

  // 이미지 + 일반 파일 업로드 — 대화창과 동일한 검증(위험 형식 차단, 50MB 제한) 적용
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || disabled) return;

    // SVG/HTML/실행파일 등 위험한 형식 차단
    const { valid, errors } = validateFiles(Array.from(files));
    if (errors.length > 0) {
      setError(errors[0]);
    }
    if (valid.length === 0) {
      e.target.value = "";
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        const { promise } = uploadFile(sessionId, file, (p) => setUploadProgress(p.progress));
        const result = await promise;

        await addPost(sessionId, {
          authorId,
          authorName,
          // 입력창 텍스트는 첫 파일에만 붙임 (여러 장 업로드 시 중복 방지)
          content: i === 0 ? content.trim() : "",
          type: file.type.startsWith("image/") ? "image" : "file",
          fileUrl: result.url,
          fileMeta: { name: result.name, size: result.size, mimeType: result.mimeType },
          gridIndex: currentPostCount + i,
          color,
          isQuestion,
        });
      }

      setContent("");
      setIsQuestion(false);
    } catch {
      setError("파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }

    setLoading(false);
    setUploadProgress(0);
    e.target.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 pb-safe border-b border-silver-mist">
      <div className="bg-buttercup border border-ochre/20 rounded-lg p-4 shadow-[--shadow-card]">
        <textarea
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
                : "포스트잇에 내용을 작성하세요"
          }
          rows={3}
          disabled={disabled}
          className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ochre/50 outline-none disabled:opacity-60"
        />
        {uploadProgress > 0 && (
          <div className="mt-1 h-1 bg-ochre/20 rounded-full overflow-hidden">
            <div className="h-full bg-graphite transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <Button type="submit" disabled={loading || !content.trim() || disabled}>
            {loading ? "게시 중..." : "게시"}
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || disabled}
            title="파일 첨부 (이미지/문서/오디오/비디오, 최대 50MB)"
            className="text-ochre hover:text-graphite cursor-pointer disabled:opacity-50"
          >
            <RiAttachmentLine size={16} />
          </button>

          {/* 색상 태그 선택 */}
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="포스트잇 색상">
            {POST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                title={POST_COLOR_STYLES[c].label}
                aria-label={`${POST_COLOR_STYLES[c].label} 포스트잇`}
                className={`w-4 h-4 rounded-full border cursor-pointer transition-transform ${
                  color === c ? "border-graphite scale-125" : "border-silver-mist"
                }`}
                style={{ backgroundColor: POST_COLOR_STYLES[c].dot }}
              />
            ))}
          </div>

          {/* 질문 토글 (Q&A) */}
          <button
            type="button"
            onClick={() => setIsQuestion((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
              isQuestion
                ? "bg-graphite text-chalk-card border-graphite"
                : "bg-transparent text-ochre border-ochre/30 hover:border-graphite"
            }`}
            title="질문으로 등록하면 질문 필터에서 모아볼 수 있습니다"
          >
            <RiQuestionLine size={12} />
            질문
          </button>

          <span className="text-xs text-ash-text ml-auto">{content.length}</span>
        </div>
        {error && <p className="text-xs text-terracotta mt-2">{error}</p>}
      </div>
    </form>
  );
}
