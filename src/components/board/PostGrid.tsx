"use client";

import { useEffect, useState } from "react";
import { Post, onPosts, deletePost } from "@/lib/firestore";
import Card from "@/components/ui/Card";
import { RiDeleteBinLine } from "react-icons/ri";

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

  async function handleDelete(postId: string) {
    if (!postId) return;
    await deletePost(sessionId, postId);
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
              className="w-full h-32 object-cover rounded-lg mb-2"
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
    <div className="grid grid-cols-5 gap-3 p-4 auto-rows-min">
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
          <p className="text-[10px] text-slate mt-2">
            {post.createdAt?.toDate?.()
              ? post.createdAt.toDate().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
              : ""}
          </p>
        </Card>
      ))}
    </div>
  );
}
