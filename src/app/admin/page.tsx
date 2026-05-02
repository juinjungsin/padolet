"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createSession, getSessionsByAdmin, Session } from "@/lib/firestore";
import { generateSessionCode } from "@/lib/session-code";
import QRCode from "qrcode";

const DOMAIN = "juinjungsin.site";

// TODO: NextAuth Google OAuth 연동 후 실제 인증으로 교체
const TEMP_ADMIN_ID = "admin_temp";

export default function AdminPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<(Session & { id: string })[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrModal, setQrModal] = useState<{ code: string; qrUrl: string; sessionId: string } | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const list = await getSessionsByAdmin(TEMP_ADMIN_ID);
    setSessions(list);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);

    const code = generateSessionCode();
    const sessionId = await createSession({
      title: title.trim(),
      description: description.trim(),
      code,
      createdBy: TEMP_ADMIN_ID,
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

  return (
    <div className="flex flex-col min-h-screen bg-eggshell">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="font-display text-4xl text-obsidian"
            style={{ fontWeight: 300, letterSpacing: "-0.72px" }}
          >
            세션 관리
          </h1>
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
