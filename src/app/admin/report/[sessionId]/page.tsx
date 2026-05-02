"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  getSession,
  Session,
  Post,
  Message,
  Participant,
} from "@/lib/firestore";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db as getDb } from "@/lib/firebase";

export default function ReportPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  async function loadReport() {
    const s = await getSession(sessionId);
    setSession(s);

    const pSnap = await getDocs(
      query(collection(getDb(), "sessions", sessionId, "participants"), orderBy("joinedAt", "asc"))
    );
    setParticipants(pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Participant));

    const postSnap = await getDocs(
      query(collection(getDb(), "sessions", sessionId, "posts"), orderBy("gridIndex", "asc"))
    );
    setPosts(postSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post));

    const msgSnap = await getDocs(
      query(collection(getDb(), "sessions", sessionId, "messages"), orderBy("createdAt", "asc"))
    );
    setMessages(msgSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Message));

    setLoading(false);
  }

  function generateMarkdown(): string {
    if (!session) return "";

    let md = `# ${session.title} — 세션 레포트\n\n`;
    md += `생성일: ${session.createdAt?.toDate?.()?.toLocaleDateString("ko-KR") || "-"}\n`;
    md += `입장코드: ${session.code}\n`;
    md += `참여자: ${participants.length}명\n\n`;

    md += `## 참여자 목록\n\n`;
    participants.forEach((p, i) => {
      md += `${i + 1}. ${p.name}${p.isAnonymous ? " (익명)" : ""}\n`;
    });

    md += `\n## 포스트잇 (${posts.length}개)\n\n`;
    posts.forEach((p, i) => {
      const time = p.createdAt?.toDate?.()?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) || "";
      md += `${i + 1}. [${p.authorName} ${time}] ${p.content}\n`;
    });

    md += `\n## 대화 (${messages.length}건)\n\n`;
    messages.forEach((m) => {
      const time = m.createdAt?.toDate?.()?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) || "";
      md += `[${time}] ${m.authorName}: ${m.content}\n`;
    });

    return md;
  }

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [session, participants, posts, messages]);

  function downloadReport() {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session?.title || "report"}_레포트.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-eggshell text-gravel">
        레포트 생성 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-eggshell">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="font-display text-4xl text-obsidian"
            style={{ fontWeight: 300, letterSpacing: "-0.72px" }}
          >
            {session?.title} — 레포트
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button onClick={downloadReport}>MD 다운로드</Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-medium text-obsidian mb-3">세션 정보</p>
            <p className="text-sm text-gravel">코드: {session?.code}</p>
            <p className="text-sm text-gravel">참여자: {participants.length}명</p>
            <p className="text-sm text-gravel">포스트잇: {posts.length}개</p>
            <p className="text-sm text-gravel">대화: {messages.length}건</p>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-medium text-obsidian mb-3">참여자 ({participants.length}명)</p>
            <div className="space-y-1">
              {participants.map((p) => (
                <p key={p.id} className="text-sm text-gravel">
                  {p.name}{p.isAnonymous ? " (익명)" : ""}
                </p>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-medium text-obsidian mb-3">포스트잇 ({posts.length}개)</p>
            <div className="space-y-2">
              {posts.map((p) => (
                <div key={p.id} className="text-sm">
                  <span className="text-gravel">{p.authorName}:</span>{" "}
                  <span className="text-obsidian">{p.content}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-medium text-obsidian mb-3">대화 ({messages.length}건)</p>
            <div className="space-y-2">
              {messages.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="text-gravel">{m.authorName}:</span>{" "}
                  <span className="text-obsidian">{m.content}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
