"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createSession, deleteSession, getSessionsByAdmin, Session } from "@/lib/firestore";
import { generateSessionCode } from "@/lib/session-code";
import QRCode from "qrcode";

const DOMAIN = "padolet.vercel.app";

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sessions, setSessions] = useState<(Session & { id: string })[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrModal, setQrModal] = useState<{ code: string; qrUrl: string; sessionId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(Session & { id: string }) | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSession(deleteTarget.id);
      setDeleteTarget(null);
      await loadSessions();
    } catch {
      alert("삭제에 실패했습니다.");
    }
    setDeleting(false);
  }

  // 로딩 중
  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center bg-parchment text-slate-text">
        로딩 중...
      </div>
    );
  }

  // 미인증 — Google 로그인 화면
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-parchment px-4">
        <div className="text-center mb-8">
          <h1
            className="font-display text-5xl text-graphite mb-3"
            style={{ fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1.08 }}
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
    <div className="flex flex-col min-h-screen bg-parchment">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-6 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1
              className="font-display text-3xl md:text-4xl text-graphite"
              style={{ fontWeight: 700, letterSpacing: "-0.9px" }}
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
            <Card key={s.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-obsidian">{s.title}</p>
                <p className="text-xs text-gravel mt-1">
                  코드: {s.code} · 참여자: {s.participantCount}명
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="ghost" onClick={() => showQR(s.code, s.id)}>
                  QR
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/board/${s.id}`)}>
                  보드
                </Button>
                <Button variant="ghost" onClick={() => router.push(`/admin/report/${s.id}`)}>
                  레포트
                </Button>
                <Button variant="ghost" onClick={() => setDeleteTarget(s)}>
                  삭제
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2
              className="font-display text-2xl text-graphite mb-3"
              style={{ fontWeight: 700, letterSpacing: "-0.5px" }}
            >
              세션 삭제
            </h2>
            <p className="text-sm text-ink mb-2">
              <span className="font-semibold">{deleteTarget.title}</span>
              <span className="text-slate-text"> · {deleteTarget.code}</span>
            </p>
            <p className="text-sm text-slate-text mb-4">
              포스트잇, 대화, 참여자 정보가 모두 영구 삭제됩니다. 복구할 수 없습니다.
            </p>
            <div className="bg-buttercup border border-ochre/20 rounded-lg p-3 mb-5">
              <p className="text-sm text-ochre font-semibold mb-1">
                삭제 전 레포트를 다운받으시겠습니까?
              </p>
              <p className="text-xs text-ochre/80">
                필요하면 먼저 레포트 페이지로 이동해 MD/PDF로 보관하세요.
              </p>
              <button
                onClick={() => router.push(`/admin/report/${deleteTarget.id}`)}
                className="mt-2 inline-flex items-center text-xs font-semibold text-ochre underline cursor-pointer hover:text-graphite"
              >
                레포트 페이지 열기 →
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                취소
              </Button>
              <Button onClick={handleConfirmDelete} disabled={deleting}>
                {deleting ? "삭제 중..." : "확인하고 삭제"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-10 text-center max-w-md">
            <h2
              className="font-display text-5xl text-graphite mb-6 font-mono"
              style={{ fontWeight: 700, letterSpacing: "0.2em", lineHeight: 1.08 }}
            >
              {qrModal.code}
            </h2>
            <img src={qrModal.qrUrl} alt="QR Code" className="mx-auto mb-4" />
            <p className="text-sm text-slate-text mb-6">
              QR 스캔 또는 코드를 입력하여 참여
            </p>
            <Button onClick={() => setQrModal(null)}>닫기</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
