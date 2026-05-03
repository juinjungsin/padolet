"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  getSession,
  getRole,
  isSuperAdmin,
  Role,
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
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const adminId = (authSession?.user as Record<string, unknown>)?.id as string | undefined;
  const email = authSession?.user?.email || null;

  // 1단계: 역할 확인 (super / admin / none)
  useEffect(() => {
    if (authStatus === "loading") return;
    if (!email) {
      setRole("none");
      return;
    }
    let cancelled = false;
    getRole(email).then((r) => {
      if (!cancelled) setRole(r);
    });
    return () => {
      cancelled = true;
    };
  }, [email, authStatus]);

  // 2단계: 역할 확인되면 세션 소유 여부 검사 후 데이터 로드
  useEffect(() => {
    if (!role) return;
    if (role === "none") {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    (async () => {
      const s = await getSession(sessionId);
      if (!s) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      // super는 모두 허용, admin은 본인 createdBy만 허용
      if (isSuperAdmin(email) || s.createdBy === adminId) {
        setAuthorized(true);
        await loadReport();
      } else {
        setAuthorized(false);
        setLoading(false);
      }
    })();
  }, [role, sessionId, email, adminId]);

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

  function exportPdf() {
    // 브라우저 인쇄 다이얼로그 → "PDF로 저장" 선택. 인쇄용 CSS는 globals.css의 @media print
    window.print();
  }

  if (authStatus === "loading" || (authorized === null && role !== "none")) {
    return (
      <div className="flex-1 flex items-center justify-center bg-parchment text-slate-text">
        권한 확인 중...
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex-1 flex items-center justify-center bg-parchment p-6">
        <Card className="max-w-md p-8 text-center">
          <h2
            className="font-display text-2xl text-graphite mb-3"
            style={{ fontWeight: 700, letterSpacing: "-0.6px" }}
          >
            접근 권한이 없습니다
          </h2>
          <p className="text-sm text-slate-text mb-6">
            이 레포트는 세션을 생성한 관리자 또는 super_admin만 열람할 수 있습니다.
          </p>
          <Button onClick={() => router.push("/")}>홈으로</Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-parchment text-slate-text">
        레포트 생성 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="font-display text-4xl text-graphite"
            style={{ fontWeight: 700, letterSpacing: "-0.9px" }}
          >
            {session?.title} — 레포트
          </h1>
          <div className="flex gap-2 flex-wrap" data-print-hide>
            <Button variant="ghost" onClick={() => router.push(`/board/${sessionId}`)}>
              보드로 돌아가기
            </Button>
            <Button variant="ghost" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button variant="ghost" onClick={exportPdf}>
              PDF 내보내기
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

        <div className="mt-10 pt-6 border-t border-silver-mist flex items-center justify-start gap-2 flex-wrap" data-print-hide>
          <Button variant="ghost" onClick={() => router.push(`/board/${sessionId}`)}>
            보드로 돌아가기
          </Button>
          <Button variant="ghost" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button variant="ghost" onClick={exportPdf}>
            PDF 내보내기
          </Button>
          <Button onClick={downloadReport}>MD 다운로드</Button>
        </div>
      </div>
    </div>
  );
}
