"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Message, onMessages, addMessage } from "@/lib/firestore";
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

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        // 스크린샷 붙여넣기 — Phase 4에서 Firebase Storage 연동 후 활성화
        await addMessage(sessionId, {
          authorId,
          authorName,
          content: "[스크린샷 — 파일 저장소 연동 후 활성화]",
          type: "text",
        });
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

    const fileArray = Array.from(files).slice(0, 20);
    for (const file of fileArray) {
      if (file.size > 50 * 1024 * 1024) {
        await addMessage(sessionId, {
          authorId,
          authorName,
          content: `⚠️ ${file.name} — 50MB 초과로 업로드할 수 없습니다.`,
          type: "text",
        });
        continue;
      }
      // Phase 4에서 실제 파일 업로드 구현
      await addMessage(sessionId, {
        authorId,
        authorName,
        content: `📎 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) — 저장소 연동 후 활성화`,
        type: "text",
      });
    }
    e.target.value = "";
  }

  return (
    <div className="flex flex-col h-full border-l border-chalk bg-white">
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
              {msg.content}
            </div>
            <p className="text-[10px] text-slate mt-0.5">
              {msg.createdAt?.toDate?.()
                ? msg.createdAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                : ""}
            </p>
          </div>
        ))}
      </div>

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
