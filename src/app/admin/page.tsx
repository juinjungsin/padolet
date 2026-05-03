"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AdminManagementPanel from "@/components/admin/AdminManagementPanel";
import Modal from "@/components/ui/Modal";
import {
  createSession,
  deleteSession,
  getSessionsByAdmin,
  getAllSessions,
  getRole,
  isSuperAdmin,
  endSession,
  reopenSession,
  getSessionStatus,
  Role,
  Session,
  SUPER_ADMIN_EMAIL,
} from "@/lib/firestore";
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
  const [role, setRole] = useState<Role | null>(null);

  const adminId = (session?.user as Record<string, unknown>)?.id as string | undefined;
  const email = session?.user?.email || null;
  const isSuper = isSuperAdmin(email);

  // 로그인 직후 역할 결정 (super / admin / none)
  useEffect(() => {
    if (!email) {
      setRole(null);
      return;
    }
    let cancelled = false;
    getRole(email).then((r) => {
      if (!cancelled) setRole(r);
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  // 역할이 결정되면 해당 권한에 맞는 세션 목록 조회
  useEffect(() => {
    if (!adminId || !role) return;
    if (role === "none") {
      setSessions([]);
      return;
    }
    loadSessions(role, adminId);
  }, [adminId, role]);

  async function loadSessions(currentRole: Role, currentAdminId: string) {
    if (currentRole === "super") {
      const list = await getAllSessions();
      setSessions(list);
    } else if (currentRole === "admin") {
      const list = await getSessionsByAdmin(currentAdminId);
      setSessions(list);
    } else {
      setSessions([]);
    }
  }

  async function reloadSessions() {
    if (!adminId || !role) return;
    await loadSessions(role, adminId);
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
    await reloadSessions();
    showQR(code, sessionId);
  }

  async function showQR(code: string, sessionId: string) {
    const joinUrl = `https://${DOMAIN}/join?code=${code}`;
    const qrUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });
    setQrModal({ code, qrUrl, sessionId });
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    // 권한 재검증 — admin은 본인 세션만 삭제 가능
    if (role === "admin" && deleteTarget.createdBy !== adminId) {
      alert("이 세션을 삭제할 권한이 없습니다.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await deleteSession(deleteTarget.id);
      setDeleteTarget(null);
      await reloadSessions();
    } catch {
      alert("삭제에 실패했습니다.");
    }
    setDeleting(false);
  }

  // 로딩 중
  if (status === "loading" || (session && role === null)) {
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
          <p className="text-base text-slate-text">관리자 로그인</p>
        </div>
        <Card className="w-full max-w-sm p-8 text-center">
          <p className="text-sm text-slate-text mb-6">
            세션을 생성하고 관리하려면 Google 계정으로 로그인하세요.
          </p>
          <Button onClick={() => signIn("google")}>Google로 로그인</Button>
        </Card>
      </div>
    );
  }

  // 인증되었으나 권한 없음
  if (role === "none") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-parchment px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h2
            className="font-display text-2xl text-graphite mb-3"
            style={{ fontWeight: 700, letterSpacing: "-0.6px" }}
          >
            권한이 없습니다
          </h2>
          <p className="text-sm text-ink mb-2">
            <span className="font-semibold">{session.user?.email}</span>
          </p>
          <p className="text-sm text-slate-text mb-6">
            이 계정은 padolet 관리자로 등록되어 있지 않습니다. 접근 권한이 필요하면 super_admin({SUPER_ADMIN_EMAIL})에게 문의하세요.
          </p>
          <Button variant="outlined" onClick={() => signOut()}>
            로그아웃
          </Button>
        </Card>
      </div>
    );
  }

  const canDelete = (s: Session) =>
    isSuper || (role === "admin" && s.createdBy === adminId);

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
            <p className="text-xs text-slate-text mt-1">
              {session.user?.name} ({session.user?.email})
              <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold bg-graphite text-chalk-card">
                {isSuper ? "SUPER" : "ADMIN"}
              </span>
              <button onClick={() => signOut()} className="ml-3 text-ash-text hover:text-graphite underline cursor-pointer">
                로그아웃
              </button>
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>새 세션 생성</Button>
        </div>

        {isSuper && <AdminManagementPanel superAdminEmail={SUPER_ADMIN_EMAIL} />}

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
            <p className="text-sm text-slate-text text-center py-12">
              {isSuper ? "생성된 세션이 없습니다." : "아직 생성된 세션이 없습니다."}
            </p>
          )}
          {sessions.map((s) => {
            const ownsSession = s.createdBy === adminId;
            const status = getSessionStatus(s);
            const isEnded = status === "ended";
            return (
              <Card
                key={s.id}
                className={`p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isEnded ? "opacity-70" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {s.title}
                    {s.createdAt?.toDate && (
                      <span className="ml-2 text-xs text-ash-text font-normal">
                        {s.createdAt.toDate().toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </span>
                    )}
                    {isEnded && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-vellum text-slate-text px-2 py-0.5 rounded-full font-semibold">
                        종료됨
                      </span>
                    )}
                    {isSuper && !ownsSession && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider bg-linen text-ink px-2 py-0.5 rounded-full font-semibold">
                        타 관리자
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-text mt-1">
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
                  {canDelete(s) &&
                    (isEnded ? (
                      <Button variant="ghost" onClick={() => reopenSession(s.id).then(reloadSessions)}>
                        재개
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`"${s.title}" 세션을 종료하시겠습니까? 종료된 세션은 새 입장이 차단됩니다.`)) {
                            endSession(s.id).then(reloadSessions);
                          }
                        }}
                      >
                        종료
                      </Button>
                    ))}
                  {canDelete(s) && (
                    <Button variant="ghost" onClick={() => setDeleteTarget(s)}>
                      삭제
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        className="max-w-md"
        showClose={!deleting}
      >
        {deleteTarget && (
          <div className="p-6">
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
          </div>
        )}
      </Modal>

      <Modal
        open={!!qrModal}
        onClose={() => setQrModal(null)}
        className="max-w-md"
        showClose
      >
        {qrModal && (
          <div className="p-10 text-center">
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
          </div>
        )}
      </Modal>
    </div>
  );
}
