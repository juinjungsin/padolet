"use client";

import { useState } from "react";
import { addPost } from "@/lib/firestore";
import Button from "@/components/ui/Button";

interface PostInputProps {
  sessionId: string;
  authorId: string;
  authorName: string;
  currentPostCount: number;
}

export default function PostInput({ sessionId, authorId, authorName, currentPostCount }: PostInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);

    const urlPattern = /^https?:\/\/\S+$/i;
    const type = urlPattern.test(content.trim()) ? "link" : "text";

    await addPost(sessionId, {
      authorId,
      authorName,
      content: content.trim(),
      type,
      gridIndex: currentPostCount,
    });

    setContent("");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-chalk">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="포스트잇에 내용을 작성하세요 (최대 500자)"
        maxLength={500}
        rows={3}
        className="w-full resize-none bg-white border border-chalk rounded-none p-3 text-sm text-obsidian placeholder:text-slate outline-none shadow-[--shadow-subtle]"
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-slate">{content.length}/500</span>
        <Button type="submit" disabled={loading || !content.trim()}>
          {loading ? "게시 중..." : "게시"}
        </Button>
      </div>
    </form>
  );
}
