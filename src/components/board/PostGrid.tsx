"use client";

import { useEffect, useState } from "react";
import { Post, onPosts, deletePost } from "@/lib/firestore";
import Card from "@/components/ui/Card";
import { RiDeleteBinLine, RiFileCopyLine } from "react-icons/ri";

interface PostGridProps {
  sessionId: string;
  isAdmin: boolean;
}

export default function PostGrid({ sessionId, isAdmin }: PostGridProps) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const unsub = onPosts(sessionId, setPosts);
    return () => unsub();
  }, [sessionId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleDelete(postId: string) {
    if (!postId) return;
    await deletePost(sessionId, postId);
  }

  async function handleCopy(text: string, postId: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(postId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function renderContent(post: Post) {
    switch (post.type) {
      case "link":
        return (
          <a
            href={post.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal-blue text-sm break-all hover:underline"
          >
            {post.content}
          </a>
        );
      case "image":
        return (
          <div>
            <img
              src={post.fileUrl}
              alt={post.fileMeta?.name || "이미지"}
              className="w-full rounded-lg mb-2 cursor-pointer"
              onClick={() => window.open(post.fileUrl, "_blank")}
            />
            {post.content && <p className="text-sm text-obsidian">{post.content}</p>}
          </div>
        );
      case "file":
        return (
          <a
            href={post.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-signal-blue hover:underline"
          >
            📎 {post.fileMeta?.name || "파일"}
          </a>
        );
      default:
        return <p className="text-sm text-obsidian whitespace-pre-wrap">{post.content}</p>;
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 auto-rows-min">
      {posts.map((post) => (
        <Card key={post.id} className="p-4 relative group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gravel">{post.authorName}</span>
            {isAdmin && post.id && (
              <button
                onClick={() => handleDelete(post.id!)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate hover:text-ember cursor-pointer"
              >
                <RiDeleteBinLine size={14} />
              </button>
            )}
          </div>
          {renderContent(post)}
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-slate">
              {post.createdAt?.toDate?.()
                ? post.createdAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                : ""}
            </p>
            <button
              onClick={() => handleCopy(post.content, post.id!)}
              className="flex items-center gap-0.5 text-[10px] text-slate hover:text-obsidian cursor-pointer transition-colors"
            >
              <RiFileCopyLine size={11} />
              {copiedId === post.id ? "Copied!" : "Copy"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
