"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Message,
  subscribeMessagesPaginated,
  MESSAGES_PAGE_SIZE,
  addMessage,
  containsBannedWord,
  isNameBlocked,
  blockUserName,
  hideMessage,
  unhideMessage,
  editMessage,
  canEditWindow,
} from "@/lib/firestore";
import { uploadFile, validateFiles, UploadProgress } from "@/lib/storage";
import { isSafeExternalUrl } from "@/lib/url-safe";
import { formatBytes, formatTime } from "@/lib/format";
import Menu from "@/components/ui/Menu";
import { findLocalPath, LOCAL_PATH_NOTICE } from "@/lib/local-path";
import {
  RiSendPlaneFill,
  RiAttachmentLine,
  RiFileCopyLine,
  RiReplyLine,
  RiUserForbidLine,
  RiEyeOffLine,
  RiEyeLine,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
  RiQuestionLine,
  RiMoreFill,
} from "react-icons/ri";

function renderTextWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part) && isSafeExternalUrl(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

interface ReplyTarget {
  id: string;
  authorName: string;
  content: string;
}

interface ChatPanelProps {
  sessionId: string;
  authorId: string;
  authorName: string;
  isAdmin?: boolean;
  bannedWords?: string[];
  blockedNames?: string[];
  /** 보드 잠금 (참여자 기준) — true면 입력/전송 불가 */
  locked?: boolean;
  /** 강사 — 메시지를 질문으로 등록 (P1-03, 원본 메시지는 그대로) */
  onLinkQuestion?: (msg: Message & { id: string }) => Promise<void>;
}

export default function ChatPanel({
  sessionId,
  authorId,
  authorName,
  isAdmin = false,
  bannedWords = [],
  blockedNames = [],
  locked = false,
  onLinkQuestion,
}: ChatPanelProps) {
  // 로컬 경로 안내 후 '그대로 보내기'를 고른 입력값 (입력이 바뀌면 다시 안내, P1-06)
  const [pathConfirmedFor, setPathConfirmedFor] = useState<string | null>(null);
  const [showPathNotice, setShowPathNotice] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const loadMoreRef = useRef<(() => Promise<void>) | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [sendError, setSendError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const blocked = isNameBlocked(authorName, blockedNames);

  useEffect(() => {
    const sub = subscribeMessagesPaginated(sessionId, MESSAGES_PAGE_SIZE, (state) => {
      setMessages(state.messages);
      setHasMore(state.hasMore);
    });
    loadMoreRef.current = sub.loadMore;
    return () => {
      sub.unsubscribe();
      loadMoreRef.current = null;
    };
  }, [sessionId]);

  async function handleLoadMore() {
    if (!loadMoreRef.current || loadingMore) return;
    setLoadingMore(true);
    const prevHeight = scrollRef.current?.scrollHeight || 0;
    await loadMoreRef.current();
    // 추가 로드 후 사용자가 보던 위치 유지
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const diff = scrollRef.current.scrollHeight - prevHeight;
      scrollRef.current.scrollTop = diff;
    });
    setLoadingMore(false);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleReply(msg: Message) {
    const preview = msg.content.length > 30 ? msg.content.slice(0, 30) + "..." : msg.content;
    setReplyTo({ id: msg.id!, authorName: msg.authorName, content: preview });
    inputRef.current?.focus();
  }

  async function handleSend(e?: React.FormEvent, confirmedPath = false) {
    e?.preventDefault();
    if (!input.trim() || sending || locked) return;

    if (blocked) {
      setSendError("관리자에 의해 차단된 사용자입니다.");
      return;
    }
    const hit = containsBannedWord(input, bannedWords);
    if (hit) {
      setSendError(`금칙어 "${hit}" 가 포함되어 게시할 수 없습니다.`);
      return;
    }
    // 내 컴퓨터 경로는 다른 사람이 열 수 없다 — 안내 후 선택 (경로에 접속해 검사하지 않음)
    if (findLocalPath(input) && !confirmedPath && pathConfirmedFor !== input) {
      setSendError("");
      setPathConfirmedFor(null);
      setShowPathNotice(true);
      return;
    }
    setSendError("");
    setShowPathNotice(false);

    setSending(true);

    let content = input.trim();
    if (replyTo) {
      content = `┃ ${replyTo.authorName}: ${replyTo.content}\n${content}`;
    }

    try {
      await addMessage(sessionId, {
        authorId,
        authorName,
        content,
        type: "text",
      });
      setInput("");
      setReplyTo(null);
    } catch {
      // 입력은 지우지 않아 다시 보낼 수 있게 둔다
      setSendError("메시지를 보내지 못했습니다. 연결 상태를 확인하고 다시 보내 주세요.");
    }
    setSending(false);
  }

  async function handleLinkQuestion(msg: Message) {
    if (!onLinkQuestion || !msg.id) return;
    setLinkingId(msg.id);
    try {
      await onLinkQuestion(msg as Message & { id: string });
    } catch {
      alert("질문으로 등록하지 못했습니다.");
    }
    setLinkingId(null);
  }

  async function handleBlock(name: string) {
    if (!isAdmin) return;
    if (!confirm(`"${name}" 사용자를 차단하시겠습니까? 차단된 사용자는 새 메시지를 보낼 수 없습니다.`))
      return;
    await blockUserName(sessionId, name);
  }

  async function handleToggleHide(msg: Message) {
    if (!isAdmin || !msg.id) return;
    if (msg.hidden) {
      await unhideMessage(sessionId, msg.id);
    } else {
      await hideMessage(sessionId, msg.id);
    }
  }

  function startEdit(msg: Message) {
    if (!msg.id || msg.type !== "text") return;
    setEditingId(msg.id);
    // 답장 prefix 제거하고 본문만 편집
    const lines = msg.content.split("\n");
    const isReply = lines[0]?.startsWith("┃ ");
    const body = isReply ? lines.slice(1).join("\n") : msg.content;
    setEditingText(body);
  }

  async function saveEdit(msg: Message) {
    if (!msg.id || !editingText.trim()) return;
    const lines = msg.content.split("\n");
    const isReply = lines[0]?.startsWith("┃ ");
    const newContent = isReply ? `${lines[0]}\n${editingText.trim()}` : editingText.trim();
    await editMessage(sessionId, msg.id, newContent);
    setEditingId(null);
    setEditingText("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
  }

  async function uploadAndSendFile(file: File) {
    if (locked) return;
    // 모든 업로드 경로(파일선택/드래그앤드롭/붙여넣기)에 공통으로 검증 적용
    const { valid, errors } = validateFiles([file]);
    if (errors.length > 0 || valid.length === 0) {
      await addMessage(sessionId, {
        authorId,
        authorName,
        content: `⚠️ ${errors[0] || `${file.name} 업로드 거부됨`}`,
        type: "text",
      });
      return;
    }

    const fileKey = `${file.name}_${Date.now()}`;
    const { promise } = uploadFile(sessionId, file, (p) => {
      setUploadProgress((prev) => ({ ...prev, [fileKey]: p }));
    });

    try {
      const result = await promise;
      const isImage = file.type.startsWith("image/");
      await addMessage(sessionId, {
        authorId,
        authorName,
        content: isImage ? "" : result.name,
        type: isImage ? "image" : "file",
        fileUrl: result.url,
        fileMeta: { name: result.name, size: result.size, mimeType: result.mimeType },
      });
    } catch {
      await addMessage(sessionId, {
        authorId,
        authorName,
        content: `⚠️ ${file.name} 업로드 실패`,
        type: "text",
      });
    } finally {
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[fileKey];
        return next;
      });
    }
  }

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const namedFile = new File([file], `screenshot_${Date.now()}.png`, { type: file.type });
          await uploadAndSendFile(namedFile);
        }
        break;
      }
    }
  }, [sessionId, authorId, authorName]);

  function handleFileClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const { valid, errors } = validateFiles(Array.from(files));

    for (const err of errors) {
      await addMessage(sessionId, {
        authorId,
        authorName,
        content: `⚠️ ${err}`,
        type: "text",
      });
    }

    for (const file of valid) {
      await uploadAndSendFile(file);
    }

    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (locked) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const { valid, errors } = validateFiles(Array.from(files));
    errors.forEach((err) => {
      addMessage(sessionId, { authorId, authorName, content: `⚠️ ${err}`, type: "text" });
    });
    valid.forEach((file) => uploadAndSendFile(file));
  }

  function renderMessageContent(msg: Message) {
    if (msg.type !== "text") return null;

    const lines = msg.content.split("\n");
    const isReply = lines[0]?.startsWith("┃ ");

    if (isReply && lines.length >= 2) {
      const quoteLine = lines[0].slice(2);
      const body = lines.slice(1).join("\n");
      return (
        <div>
          <div className={`text-xs mb-1 px-2 py-1 rounded border-l-2 ${
            msg.authorId === authorId
              ? "border-eggshell/50 bg-white/10 text-eggshell/70"
              : "border-gravel/30 bg-obsidian/5 text-gravel"
          }`}>
            {quoteLine}
          </div>
          <div>{renderTextWithLinks(body)}</div>
        </div>
      );
    }

    return <>{renderTextWithLinks(msg.content)}</>;
  }

  const uploading = Object.keys(uploadProgress).length > 0;

  return (
    <div
      data-testid="chat-panel"
      className="flex flex-col h-full border-l border-chalk bg-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="px-4 py-3 border-b border-silver-mist">
        <h2 className="text-base font-semibold text-graphite">대화</h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {hasMore && (
          <div className="flex justify-center mb-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-slate-text hover:text-graphite px-3 py-1 rounded-full border border-silver-mist hover:border-graphite transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? "불러오는 중..." : "이전 메시지 보기"}
            </button>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} data-message-id={msg.id} className={`${msg.authorId === authorId ? "text-right" : ""}`}>
            <p className="text-xs font-semibold text-slate-text mb-1">{msg.authorName}</p>
            {msg.hidden ? (
              <div
                className={`inline-block max-w-[85%] px-3 py-2 rounded-2xl text-[15px] text-left bg-vellum text-ash-text border border-silver-mist italic ${
                  isAdmin ? "opacity-90" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <RiEyeOffLine size={12} />
                  관리자가 숨긴 메시지입니다
                </span>
                {isAdmin && (
                  <div className="mt-1 text-xs text-slate-text not-italic">
                    원본: {msg.content || "(파일/이미지)"}
                  </div>
                )}
              </div>
            ) : editingId === msg.id ? (
              <div className="inline-block max-w-[85%] w-full">
                <textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full p-2 text-sm text-ink bg-vellum border border-silver-mist rounded-md outline-none focus:border-graphite resize-none"
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-0.5 text-xs h-7 px-1 text-slate hover:text-graphite cursor-pointer"
                  >
                    <RiCloseLine size={11} />
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(msg)}
                    disabled={!editingText.trim()}
                    className="inline-flex items-center gap-0.5 text-xs h-7 px-1 text-graphite font-semibold hover:text-blueprint disabled:opacity-40 cursor-pointer"
                  >
                    <RiCheckLine size={11} />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`inline-block max-w-[85%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed text-left whitespace-pre-wrap ${
                  msg.authorId === authorId
                    ? "bg-obsidian text-eggshell"
                    : "bg-powder text-obsidian"
                }`}
              >
                {msg.type === "image" && msg.fileUrl && isSafeExternalUrl(msg.fileUrl) && (
                  <img
                    src={msg.fileUrl}
                    alt={msg.fileMeta?.name || "이미지"}
                    className="max-w-full rounded-lg mb-1 cursor-pointer"
                    onClick={() => {
                      if (msg.fileUrl && isSafeExternalUrl(msg.fileUrl)) {
                        window.open(msg.fileUrl, "_blank", "noopener,noreferrer");
                      }
                    }}
                  />
                )}
                {msg.type === "file" && msg.fileUrl && isSafeExternalUrl(msg.fileUrl) && (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    📎 {msg.fileMeta?.name || "파일"} ({formatBytes(msg.fileMeta?.size)})
                  </a>
                )}
                {msg.type === "text" && renderMessageContent(msg)}
                {/* 파일 메시지의 content는 파일명과 같으므로 중복 표시하지 않음 */}
                {msg.type !== "text" && msg.content && msg.content !== msg.fileMeta?.name && (
                  <p className="mt-1">{msg.content}</p>
                )}
              </div>
            )}
            <div className={`flex flex-wrap items-center gap-x-1.5 mt-0.5 ${msg.authorId === authorId ? "justify-end" : ""}`}>
              <p className="text-xs text-ash-text whitespace-nowrap">
                {formatTime(msg.createdAt)}
                {msg.editedAt && <span className="ml-1 italic">· 수정됨</span>}
              </p>
              {!msg.hidden && msg.content && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(msg.content);
                      setCopiedId(msg.id!);
                      setTimeout(() => setCopiedId(null), 1500);
                    } catch {
                      setCopiedId(`failed:${msg.id}`);
                    }
                  }}
                  className="touch-target flex items-center gap-0.5 h-7 px-1 text-xs text-slate-text hover:text-obsidian cursor-pointer transition-colors whitespace-nowrap"
                >
                  <RiFileCopyLine size={10} />
                  {copiedId === msg.id ? "복사됨" : copiedId === `failed:${msg.id}` ? "복사 실패 — 다시 시도" : "복사"}
                </button>
              )}
              <button
                onClick={() => handleReply(msg)}
                className="touch-target flex items-center gap-0.5 h-7 px-1 text-xs text-slate-text hover:text-obsidian cursor-pointer transition-colors whitespace-nowrap"
              >
                <RiReplyLine size={10} />
                답글
              </button>
              {msg.authorId === authorId &&
                msg.type === "text" &&
                !msg.hidden &&
                !locked &&
                canEditWindow(msg.createdAt) &&
                editingId !== msg.id && (
                  <button
                    onClick={() => startEdit(msg)}
                    title="수정 (작성 후 5분 이내)"
                    className="touch-target flex items-center gap-0.5 h-7 px-1 text-xs text-slate-text hover:text-graphite cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <RiEditLine size={10} />
                    수정
                  </button>
                )}
              {msg.linkedPostId && (
                <span className="inline-flex items-center gap-0.5 h-7 px-1 text-xs font-semibold text-ochre whitespace-nowrap">
                  <RiQuestionLine size={10} aria-hidden />
                  질문으로 등록됨
                </span>
              )}
              {/* 강사 전용 조작은 메뉴로 묶어 좁은 대화창에서도 글자 단위로 줄바꿈되지 않게 한다 */}
              {isAdmin && (
                <Menu
                  label="메시지 메뉴"
                  align={msg.authorId === authorId ? "right" : "left"}
                  items={[
                    ...(onLinkQuestion && msg.type === "text" && !msg.hidden && !msg.linkedPostId
                      ? [
                          {
                            key: "question",
                            label: linkingId === msg.id ? "등록 중..." : "질문으로 등록 (원본 유지)",
                            icon: <RiQuestionLine size={16} />,
                            onSelect: () => handleLinkQuestion(msg),
                          },
                        ]
                      : []),
                    {
                      key: "hide",
                      label: msg.hidden ? "다시 보이기" : "숨기기",
                      icon: msg.hidden ? <RiEyeLine size={16} /> : <RiEyeOffLine size={16} />,
                      onSelect: () => handleToggleHide(msg),
                    },
                    ...(msg.authorId !== authorId
                      ? [
                          {
                            key: "block",
                            label: `${msg.authorName} 차단`,
                            icon: <RiUserForbidLine size={16} />,
                            onSelect: () => handleBlock(msg.authorName),
                            danger: true,
                          },
                        ]
                      : []),
                  ]}
                  triggerClassName="touch-target inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer"
                  trigger={<RiMoreFill size={14} aria-hidden />}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {uploading && (
        <div className="px-4 py-2 border-t border-chalk">
          {Object.entries(uploadProgress).map(([key, p]) => (
            <div key={key} className="flex items-center gap-2 text-xs text-gravel">
              <div className="flex-1 h-1 bg-chalk rounded-full overflow-hidden">
                <div className="h-full bg-obsidian transition-all" style={{ width: `${p.progress}%` }} />
              </div>
              <span>{p.progress}%</span>
            </div>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="px-3 py-2 border-t border-chalk bg-powder flex items-center gap-2">
          <RiReplyLine size={12} className="text-gravel flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-text font-semibold">{replyTo.authorName}</p>
            <p className="text-sm text-ink truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="답글 취소"
            className="touch-target inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-text hover:text-graphite cursor-pointer"
          >
            <RiCloseLine size={16} aria-hidden />
          </button>
        </div>
      )}

      {showPathNotice && findLocalPath(input) && (
        <div role="alert" data-testid="chat-local-path-notice" className="px-4 py-2 border-t border-silver-mist bg-warn-bg text-sm text-warn">
          <p className="font-semibold">{LOCAL_PATH_NOTICE}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPathNotice(false);
                handleFileClick();
              }}
              className="touch-target inline-flex items-center h-8 px-3 rounded-full bg-graphite text-chalk-card font-semibold cursor-pointer"
            >
              파일 첨부하기
            </button>
            <button
              type="button"
              onClick={() => {
                setPathConfirmedFor(input);
                handleSend(undefined, true);
              }}
              className="touch-target inline-flex items-center h-8 px-3 rounded-full border border-warn/40 font-semibold cursor-pointer"
            >
              그대로 보내기
            </button>
          </div>
        </div>
      )}

      {sendError && (
        <div className="px-4 py-2 border-t border-silver-mist bg-buttercup">
          <p role="alert" className="text-sm text-ochre">{sendError}</p>
        </div>
      )}

      {locked ? (
        <div className="p-3 border-t border-silver-mist bg-buttercup text-center">
          <p className="text-xs text-ochre font-semibold">
            보드가 잠금 상태입니다. 열람만 가능합니다.
          </p>
        </div>
      ) : blocked ? (
        <div className="p-3 border-t border-silver-mist bg-vellum text-center">
          <p className="text-xs text-terracotta font-semibold">
            관리자에 의해 채팅이 차단되었습니다.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSend} onPaste={handlePaste} className="p-3 pb-safe border-t border-silver-mist flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleFileClick}
            aria-label="파일 첨부 (최대 50MB)"
            title="파일 첨부 (최대 50MB)"
            className="touch-target inline-flex items-center justify-center w-10 h-10 rounded-full text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer"
          >
            <RiAttachmentLine size={20} aria-hidden />
          </button>
          <label htmlFor={`chat-input-${sessionId}`} className="sr-only">
            메시지 입력
          </label>
          <input
            id={`chat-input-${sessionId}`}
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (sendError) setSendError("");
            }}
            onFocus={() => {
              // 모바일 가상 키보드 등장 시 입력창이 보이도록 스크롤 보정
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
              }, 300);
            }}
            placeholder={replyTo ? `${replyTo.authorName}에게 답장...` : "메시지 입력..."}
            className="flex-1 min-w-0 h-10 bg-transparent text-base text-ink placeholder:text-ash-text outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="보내기"
            className="touch-target inline-flex items-center justify-center w-10 h-10 rounded-full text-graphite hover:bg-vellum disabled:text-ash-text cursor-pointer"
          >
            <RiSendPlaneFill size={20} aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
