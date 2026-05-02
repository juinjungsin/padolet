"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createSession, getSessionsByAdmin, Session } from "@/lib/firestore";
import { generateSessionCode } from "@/lib/session-code";
import QRCode from "qrcode";

const DOMAIN = "juinjungsin.site";

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sessions, setSessions] = useState<(Session & { id: string })[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrModal, setQrModal] = useState<{ code: string; qrUrl: string; sessionId: string } | null>(null);

  const adminId = (session?.user as Record<string, unknown>)?.id as string | undefined;

  useEffect(() => {
    if (adminId) loadSessions();
  }, [adminId]);

  async function loadSessions() {
    if (!adminId) return;
    const list = await getSessionsByAdmin(adminId);
    setSessions(list);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !adminId) return;
    setCreating(true);

    const code = generateSessionCode();
    const sessionId = await createSession({
      title: title.trim(),
      description: description.trim(),
      code,
      createdBy: adminId,
      requireGoogleLogin: false,
    });

    setTitle("");
    setDescription("");
    setShowCreate(false);
    setCreating(false);
    await loadSessions();
    showQR(code, sessionId);
  }

  async function showQR(code: string, sessionId: string) {
    const joinUrl = `https://${DOMAIN}/join?code=${code}`;
    const qrUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });
    setQrModal({ code, qrUrl, sessionId });
  }

  // 로딩 중
  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center bg-eggshell text-gravel">
        로딩 중...
      </div>
    );
  }

  // 미인증 — Google 로그인 화면
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-eggshell px-4">
        <div className="text-center mb-8">
          <h1
            className="font-display text-5xl text-obsidian mb-3"
            style={{ fontWeight: 300, letterSpacing: "-0.96px", lineHeight: 1.08 }}
          >
            padolet
          </h1>
          <p className="text-base text-gravel">강사 로그인</p>
        </div>
        <Card className="w-full max-w-sm p-8 text-center">
          <p className="text-sm text-gravel mb-6">
            세션을 생성하고 관리하려면 Google 계정으로 로그인하세요.
          </p>
          <Button onClick={() => signIn("google")}>Google로 로그인</Button>
        </Card>
      </div>
    );
  }

  // 인증된 Admin 대시보드
  return (
    <div className="flex flex-col min-h-screen bg-eggshell">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="font-display text-4xl text-obsidian"
              style={{ fontWeight: 300, letterSpacing: "-0.72px" }}
            >
              세션 관리
            </h1>
            <p className="text-xs text-gravel mt-1">
              {session.user?.name} ({session.user?.email})
              <button onClick={() => signOut()} className="ml-2 text-slate hover:text-obsidian underline cursor-pointer">
                로그아웃
              </button>
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>새 세션 생성</Button>
        </div>

        {showCreate && (
          <Card className="p-6 mb-8">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <Input
                variant="contained"
                placeholder="세션 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Input
                variant="contained"
                placeholder="설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-3">
                <Button type="submit" disabled={creating}>
                  {creating ? "생성 중..." : "생성"}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                  취소
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="text-sm text-gravel text-center py-12">아직 생성된 세션이 없습니다.</p>
          )}
          {sessions.map((s) => (
            <Card key={s.id} className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-obsidian">{s.title}</p>
                <p className="text-xs text-gravel mt-1">
                  코드: {s.code} · 참여자: {s.participantCount}명
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => showQR(s.code, s.id)}>
                  QR
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/board/${s.id}`)}>
                  보드
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/admin/report/${s.id}`)}>
                  레포트
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {qrModal && (
        <div className="fixed inset-0 bg-obsidian/50 flex items-center justify-center z-50">
          <Card className="p-10 text-center max-w-md">
            <h2
              className="font-display text-5xl text-obsidian mb-6"
              style={{ fontWeight: 300, letterSpacing: "-0.96px", lineHeight: 1.08 }}
            >
              {qrModal.code}
            </h2>
            <img src={qrModal.qrUrl} alt="QR Code" className="mx-auto mb-4" />
            <p className="text-sm text-gravel mb-6">
              QR 스캔 또는 코드를 입력하여 참여
            </p>
            <Button onClick={() => setQrModal(null)}>닫기</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
