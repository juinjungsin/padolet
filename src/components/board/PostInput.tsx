"use client";

import { useState, useRef } from "react";
import { addPost } from "@/lib/firestore";
import { uploadFile } from "@/lib/storage";
import Button from "@/components/ui/Button";
import { RiImageAddLine } from "react-icons/ri";

interface PostInputProps {
  sessionId: string;
  authorId: string;
  authorName: string;
  currentPostCount: number;
}

export default function PostInput({ sessionId, authorId, authorName, currentPostCount }: PostInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUploadProgress(0);

    try {
      const { promise } = uploadFile(sessionId, file, (p) => setUploadProgress(p.progress));
      const result = await promise;

      await addPost(sessionId, {
        authorId,
        authorName,
        content: content.trim(),
        type: "image",
        fileUrl: result.url,
        fileMeta: { name: result.name, size: result.size, mimeType: result.mimeType },
        gridIndex: currentPostCount,
      });

      setContent("");
    } catch {
      // 업로드 실패 시 무시
    }

    setLoading(false);
    setUploadProgress(0);
    e.target.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 border-b border-chalk">
      <div className="bg-[#fffde6] border border-[#f0e68c] rounded-xl p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="포스트잇에 내용을 작성하세요"
          rows={3}
          className="w-full resize-none bg-transparent text-sm text-obsidian placeholder:text-slate/60 outline-none"
        />
        {uploadProgress > 0 && (
          <div className="mt-1 h-1 bg-[#f0e68c] rounded-full overflow-hidden">
            <div className="h-full bg-obsidian transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <Button type="submit" disabled={loading || !content.trim()}>
            {loading ? "게시 중..." : "게시"}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="text-slate hover:text-obsidian cursor-pointer disabled:opacity-50"
          >
            <RiImageAddLine size={16} />
          </button>
          <span className="text-xs text-slate ml-auto">{content.length}</span>
        </div>
      </div>
    </form>
  );
}
