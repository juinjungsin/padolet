"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Message, onMessages, addMessage } from "@/lib/firestore";
import { uploadFile, validateFiles, UploadProgress } from "@/lib/storage";
import { RiSendPlaneFill, RiAttachmentLine } from "react-icons/ri";

interface ChatPanelProps {
  sessionId: string;
  authorId: string;
  authorName: string;
}

export default function ChatPanel({ sessionId, authorId, authorName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onMessages(sessionId, setMessages);
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    await addMessage(sessionId, {
      authorId,
      authorName,
      content: input.trim(),
      type: "text",
    });
    setInput("");
    setSending(false);
  }

  async function uploadAndSendFile(file: File) {
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
        {messages.map((msg) => (
          <div key={msg.id} className={`${msg.authorId === authorId ? "text-right" : ""}`}>
            <p className="text-[10px] text-gravel mb-0.5">{msg.authorName}</p>
            <div
              className={`inline-block max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                msg.authorId === authorId
                  ? "bg-obsidian text-eggshell"
                  : "bg-powder text-obsidian"
              }`}
            >
              {msg.type === "image" && msg.fileUrl && (
                <img
                  src={msg.fileUrl}
                  alt={msg.fileMeta?.name || "이미지"}
                  className="max-w-full rounded-lg mb-1 cursor-pointer"
                  onClick={() => window.open(msg.fileUrl, "_blank")}
                />
              )}
              {msg.type === "file" && msg.fileUrl && (
                <a
                  href={msg.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  📎 {msg.fileMeta?.name || "파일"} ({((msg.fileMeta?.size || 0) / 1024 / 1024).toFixed(1)}MB)
                </a>
              )}
              {msg.type === "text" && msg.content}
              {msg.type !== "text" && msg.content && <p className="mt-1">{msg.content}</p>}
            </div>
            <p className="text-[10px] text-slate mt-0.5">
              {msg.createdAt?.toDate?.()
                ? msg.createdAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                : ""}
            </p>
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

      <form onSubmit={handleSend} onPaste={handlePaste} className="p-3 border-t border-chalk flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button type="button" onClick={handleFileClick} className="text-slate hover:text-obsidian cursor-pointer">
          <RiAttachmentLine size={18} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지 입력..."
          className="flex-1 bg-transparent text-sm text-obsidian placeholder:text-slate outline-none"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="text-obsidian disabled:text-fog cursor-pointer"
        >
          <RiSendPlaneFill size={18} />
        </button>
      </form>
    </div>
  );
}
