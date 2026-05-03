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
}

export default function ChatPanel({
  sessionId,
  authorId,
  authorName,
  isAdmin = false,
  bannedWords = [],
  blockedNames = [],
}: ChatPanelProps) {
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    if (blocked) {
      setSendError("관리자에 의해 차단된 사용자입니다.");
      return;
    }
    const hit = containsBannedWord(input, bannedWords);
    if (hit) {
      setSendError(`금칙어 "${hit}" 가 포함되어 게시할 수 없습니다.`);
      return;
    }
    setSendError("");

    setSending(true);

    let content = input.trim();
    if (replyTo) {
      content = `┃ ${replyTo.authorName}: ${replyTo.content}\n${content}`;
    }

    await addMessage(sessionId, {
      authorId,
      authorName,
      content,
      type: "text",
    });
    setInput("");
    setReplyTo(null);
    setSending(false);
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
          <div className={`text-[11px] mb-1 px-2 py-1 rounded border-l-2 ${
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
      className="flex flex-col h-full border-l border-chalk bg-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="px-4 py-3 border-b border-chalk">
        <span className="text-sm font-medium text-obsidian">대화</span>
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
          <div key={msg.id} className={`${msg.authorId === authorId ? "text-right" : ""}`}>
            <p className="text-[10px] text-gravel mb-0.5">{msg.authorName}</p>
            {msg.hidden ? (
              <div
                className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm text-left bg-vellum text-ash-text border border-silver-mist italic ${
                  isAdmin ? "opacity-90" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <RiEyeOffLine size={12} />
                  관리자가 메시지를 가렸습니다
                </span>
                {isAdmin && (
                  <div className="mt-1 text-[10px] text-slate-text not-italic">
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
                    className="inline-flex items-center gap-0.5 text-[10px] text-slate hover:text-graphite cursor-pointer"
                  >
                    <RiCloseLine size={11} />
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(msg)}
                    disabled={!editingText.trim()}
                    className="inline-flex items-center gap-0.5 text-[10px] text-graphite font-semibold hover:text-blueprint disabled:opacity-40 cursor-pointer"
                  >
                    <RiCheckLine size={11} />
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm text-left ${
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
                    📎 {msg.fileMeta?.name || "파일"} ({((msg.fileMeta?.size || 0) / 1024 / 1024).toFixed(1)}MB)
                  </a>
                )}
                {msg.type === "text" && renderMessageContent(msg)}
                {msg.type !== "text" && msg.content && <p className="mt-1">{msg.content}</p>}
              </div>
            )}
            <div className={`flex items-center gap-2 mt-0.5 ${msg.authorId === authorId ? "justify-end" : ""}`}>
              <p className="text-[10px] text-slate">
                {msg.createdAt?.toDate?.()
                  ? msg.createdAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                  : ""}
                {msg.editedAt && <span className="ml-1 italic">· 수정됨</span>}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(msg.content);
                  setCopiedId(msg.id!);
                  setTimeout(() => setCopiedId(null), 1500);
                }}
                className="flex items-center gap-0.5 text-[10px] text-slate hover:text-obsidian cursor-pointer transition-colors"
              >
                <RiFileCopyLine size={10} />
                {copiedId === msg.id ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => handleReply(msg)}
                className="flex items-center gap-0.5 text-[10px] text-slate hover:text-obsidian cursor-pointer transition-colors"
              >
                <RiReplyLine size={10} />
                Reply
              </button>
              {msg.authorId === authorId &&
                msg.type === "text" &&
                !msg.hidden &&
                canEditWindow(msg.createdAt) &&
                editingId !== msg.id && (
                  <button
                    onClick={() => startEdit(msg)}
                    title="편집 (5분 이내)"
                    className="flex items-center gap-0.5 text-[10px] text-slate hover:text-graphite cursor-pointer transition-colors"
                  >
                    <RiEditLine size={10} />
                    Edit
                  </button>
                )}
              {isAdmin && (
                <button
                  onClick={() => handleToggleHide(msg)}
                  className="flex items-center gap-0.5 text-[10px] text-slate hover:text-graphite cursor-pointer transition-colors"
                  title={msg.hidden ? "다시 보이기" : "메시지 가리기"}
                >
                  {msg.hidden ? <RiEyeLine size={10} /> : <RiEyeOffLine size={10} />}
                  {msg.hidden ? "Unhide" : "Hide"}
                </button>
              )}
              {isAdmin && msg.authorId !== authorId && (
                <button
                  onClick={() => handleBlock(msg.authorName)}
                  className="flex items-center gap-0.5 text-[10px] text-slate hover:text-terracotta cursor-pointer transition-colors"
                  title={`${msg.authorName} 차단`}
                >
                  <RiUserForbidLine size={10} />
                  Block
                </button>
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
            <p className="text-[10px] text-gravel font-medium">{replyTo.authorName}</p>
            <p className="text-[11px] text-slate truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-slate hover:text-obsidian cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {sendError && (
        <div className="px-4 py-2 border-t border-silver-mist bg-buttercup">
          <p className="text-xs text-ochre">{sendError}</p>
        </div>
      )}

      {blocked ? (
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
          <button type="button" onClick={handleFileClick} className="text-slate-text hover:text-graphite cursor-pointer">
            <RiAttachmentLine size={18} />
          </button>
          <input
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
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ash-text outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="text-graphite disabled:text-ash-text cursor-pointer"
          >
            <RiSendPlaneFill size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
