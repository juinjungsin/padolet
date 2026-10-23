"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { onAuthStateChanged } from "firebase/auth";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Menu, { MenuItem } from "@/components/ui/Menu";
import {
  addParticipant,
  archiveSession,
  createSession,
  deleteSession,
  duplicateSession,
  endSession,
  getAllSessions,
  getParticipantCount,
  getRole,
  getSessionByCode,
  getSessionsByAdmin,
  isSuperAdmin,
  reopenSession,
  Role,
  Session,
  SUPER_ADMIN_EMAIL,
  touchSessionLastUsed,
  unarchiveSession,
  updateSessionInfo,
} from "@/lib/firestore";
import { auth as firebaseAuth, USE_EMULATOR } from "@/lib/firebase";
import { generateSessionCode } from "@/lib/session-code";
import { METRICS } from "@/lib/metrics";
import { formatDate } from "@/lib/format";
import {
  filterSessions,
  formatEventDate,
  sessionStatus,
  SessionSortMode,
  SessionStatusFilter,
  SORT_MODES,
  sortSessions,
  STATUS_FILTERS,
  STATUS_HELP,
  STATUS_LABEL,
} from "@/lib/session-list";
import QRCode from "qrcode";
import {
  RiLinkM,
  RiCheckLine,
  RiMoreFill,
  RiQrCodeLine,
  RiEditLine,
  RiFileCopy2Line,
  RiStopCircleLine,
  RiPlayCircleLine,
  RiArchiveLine,
  RiInboxUnarchiveLine,
  RiDeleteBinLine,
  RiSearchLine,
  RiShieldUserLine,
  RiAddLine,
} from "react-icons/ri";

const DOMAIN = "padolet.vercel.app";

type SessionItem = Session & { id: string };
type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; sessions: SessionItem[] };

// 로컬 에뮬레이터 전용 로그인 (운영에서는 렌더되지 않음)
function EmulatorLoginForm() {
  const [email, setEmail] = useState("jongbin@gmail.com");
  return (
    <form
      className="mt-6 pt-6 border-t border-silver-mist flex flex-col gap-2 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        signIn("emulator", { email, callbackUrl: "/admin" });
      }}
    >
      <label htmlFor="emu-email" className="text-xs text-slate-text">
        에뮬레이터 로그인 (로컬 검증 전용)
      </label>
      <Input id="emu-email" variant="contained" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" variant="outlined">
        에뮬레이터로 로그인
      </Button>
    </form>
  );
}

async function fetchSessions(role: Role, uid: string): Promise<SessionItem[]> {
  if (role === "super") return getAllSessions();
  if (role === "admin") return getSessionsByAdmin(uid);
  return [];
}

/** 세션 정보(제목·교육일·설명) 입력 폼 — 생성과 수정에 함께 쓴다 */
function SessionInfoFields({
  idPrefix,
  title,
  eventDate,
  description,
  onChange,
}: {
  idPrefix: string;
  title: string;
  eventDate: string;
  description: string;
  onChange: (v: { title?: string; eventDate?: string; description?: string }) => void;
}) {
  const label = "block text-sm font-semibold text-ink mb-1";
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-title`} className={label}>
          세션 제목 <span className="text-terracotta">*</span>
        </label>
        <Input id={`${idPrefix}-title`} value={title} onChange={(e) => onChange({ title: e.target.value })} required />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-date`} className={label}>
          교육일 <span className="font-normal text-slate-text">(선택 — 생성일과 별개)</span>
        </label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={eventDate}
          onChange={(e) => onChange({ eventDate: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-desc`} className={label}>
          설명 <span className="font-normal text-slate-text">(선택)</span>
        </label>
        <Input
          id={`${idPrefix}-desc`}
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number | "error">>({});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", eventDate: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>("visible");
  const [sortMode, setSortMode] = useState<SessionSortMode>("recent");
  const [qrModal, setQrModal] = useState<{ code: string; qrUrl: string; sessionId: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<SessionItem | null>(null);
  const [editForm, setEditForm] = useState({ title: "", eventDate: "", description: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  // 역할은 이메일과 짝지어 보관 (로그아웃·계정 전환 시 이전 역할을 쓰지 않도록)
  const [roleState, setRoleState] = useState<{ email: string; role: Role } | null>(null);
  // Firestore Rules는 Firebase Auth uid로 세션 소유자를 판별하므로 NextAuth의 sub 대신 이 값을 사용.
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  const email = session?.user?.email || null;
  const isSuper = isSuperAdmin(email);
  const role = email && roleState?.email === email ? roleState.role : null;

  // Firebase Auth 상태 구독 (FirebaseAuthSync가 이중 로그인 완료 시점 감지)
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), (u) => {
      setFirebaseUid(u && !u.isAnonymous ? u.uid : null);
    });
    return () => unsub();
  }, []);

  // 로그인 직후 역할 결정 (super / admin / none)
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    getRole(email).then((r) => {
      if (!cancelled) setRoleState({ email, role: r });
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  // 역할이 결정되고 Firebase Auth uid도 준비되면 세션 목록 조회 (reloadKey로 다시 조회)
  useEffect(() => {
    if (!firebaseUid || !role || role === "none") return;
    let cancelled = false;
    fetchSessions(role, firebaseUid)
      .then((sessions) => {
        if (cancelled) return;
        setList({ status: "ready", sessions });
        // 누적 입장 — 세션 문서의 participantCount(갱신 중단된 값) 대신 참여자 문서 수를 집계
        return Promise.all(
          sessions.map(async (s) => {
            try {
              return [s.id, await getParticipantCount(s.id)] as const;
            } catch {
              return [s.id, "error"] as const;
            }
          })
        ).then((entries) => {
          if (!cancelled) setParticipantCounts(Object.fromEntries(entries));
        });
      })
      .catch(() => {
        if (!cancelled) setList({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUid, role, reloadKey]);

  const reloadSessions = () => setReloadKey((k) => k + 1);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!firebaseUid) {
      alert("Firebase 인증 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    setCreating(true);
    try {
      const code = await generateUniqueCode();
      const sessionId = await createSession({
        title: form.title.trim(),
        description: form.description.trim(),
        eventDate: form.eventDate || null,
        code,
        createdBy: firebaseUid,
        requireGoogleLogin: false,
      });
      setForm({ title: "", eventDate: "", description: "" });
      setShowCreate(false);
      reloadSessions();
      showQR(code, sessionId);
    } catch (err) {
      console.error("[admin] 세션 생성 실패", err);
      alert("세션 생성에 실패했습니다. 브라우저 콘솔의 오류를 확인해주세요.");
    } finally {
      setCreating(false);
    }
  }

  // 4자리 코드는 충돌 가능성이 있어 생성 시 중복 검사 (최대 10회 재시도)
  async function generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = generateSessionCode();
      const existing = await getSessionByCode(code);
      if (!existing) return code;
    }
    throw new Error("입장코드 생성 충돌 — 다시 시도해주세요.");
  }

  async function showQR(code: string, sessionId: string) {
    const joinUrl = `https://${DOMAIN}/join?code=${code}`;
    const qrUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });
    setLinkCopied(false);
    setQrModal({ code, qrUrl, sessionId });
  }

  async function handleCopyJoinLink() {
    if (!qrModal) return;
    try {
      await navigator.clipboard.writeText(`https://${DOMAIN}/join?code=${qrModal.code}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      alert("클립보드 복사에 실패했습니다.");
    }
  }

  // 관리자 보드 바로 입장 — 참여자 등록 + 입장 기록을 만든 뒤 이동 (join 화면 생략)
  async function enterBoard(boardSessionId: string) {
    if (!firebaseUid) {
      alert("Firebase 인증 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const name = session?.user?.name || "관리자";
    try {
      await addParticipant(boardSessionId, firebaseUid, {
        name,
        isAnonymous: false,
        isOnline: true,
      });
    } catch {
      // 참여자 등록 실패해도 입장 기록은 남기고 이동 (보드에서 재시도됨)
    }
    touchSessionLastUsed(boardSessionId).catch(() => {});
    sessionStorage.setItem(
      `padolet_${boardSessionId}`,
      JSON.stringify({ participantId: firebaseUid, name })
    );
    router.push(`/board/${boardSessionId}`);
  }

  // 세션 복제 — 설정(제목/설명/금칙어/차단 이름)만 복사, 새 코드 발급
  async function handleDuplicate(source: SessionItem) {
    if (!firebaseUid) return;
    if (!confirm(`"${source.title}" 세션의 설정을 복사해 새 세션을 만드시겠습니까?`)) return;
    try {
      const newCode = await generateUniqueCode();
      const newSessionId = await duplicateSession(source, newCode, firebaseUid);
      reloadSessions();
      showQR(newCode, newSessionId);
    } catch (err) {
      console.error("[admin] 세션 복제 실패", err);
      alert("세션 복제에 실패했습니다.");
    }
  }

  async function runAndReload(action: () => Promise<unknown>, failMessage: string) {
    try {
      await action();
      reloadSessions();
    } catch {
      alert(failMessage);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    // 권한 재검증 — admin은 본인 세션만 삭제 가능
    if (role === "admin" && deleteTarget.createdBy !== firebaseUid) {
      alert("이 세션을 삭제할 권한이 없습니다.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await deleteSession(deleteTarget.id);
      setDeleteTarget(null);
      reloadSessions();
    } catch {
      alert("삭제에 실패했습니다.");
    }
    setDeleting(false);
  }

  function openEdit(s: SessionItem) {
    setEditForm({ title: s.title, eventDate: s.eventDate || "", description: s.description || "" });
    setEditTarget(s);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget || !editForm.title.trim()) return;
    setSavingEdit(true);
    try {
      await updateSessionInfo(editTarget.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        eventDate: editForm.eventDate || null,
      });
      setEditTarget(null);
      reloadSessions();
    } catch {
      alert("세션 정보 저장에 실패했습니다.");
    }
    setSavingEdit(false);
  }

  // 로딩 중 (NextAuth 세션 or 역할 or Firebase Auth 준비 대기)
  if (status === "loading" || (session && role === null) || (session && role !== "none" && !firebaseUid)) {
    return (
      <div role="status" className="flex-1 flex items-center justify-center text-slate-text">
        로그인 정보를 확인하는 중...
      </div>
    );
  }

  // 미인증 — Google 로그인 화면
  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8">
          <h1
            className="font-brand text-5xl text-graphite mb-3"
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
          {USE_EMULATOR && <EmulatorLoginForm />}
        </Card>
      </div>
    );
  }

  // 인증되었으나 권한 없음
  if (role === "none") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-graphite mb-3">권한이 없습니다</h2>
          <p className="text-sm text-ink mb-2">
            <span className="font-semibold">{session.user?.email}</span>
          </p>
          <p className="text-sm text-slate-text mb-6">
            이 계정은 padolet 관리자로 등록되어 있지 않습니다. 접근 권한이 필요하면 최고 관리자({SUPER_ADMIN_EMAIL})에게 문의하세요.
          </p>
          <Button variant="outlined" onClick={() => signOut()}>
            로그아웃
          </Button>
        </Card>
      </div>
    );
  }

  const canManage = (s: Session) => isSuper || (role === "admin" && s.createdBy === firebaseUid);

  function sessionMenu(s: SessionItem): MenuItem[] {
    const st = sessionStatus(s);
    const items: MenuItem[] = [
      { key: "qr", label: "QR·입장 링크", icon: <RiQrCodeLine size={16} />, onSelect: () => showQR(s.code, s.id) },
    ];
    if (canManage(s)) {
      items.push({ key: "edit", label: "정보 수정 (제목·교육일)", icon: <RiEditLine size={16} />, onSelect: () => openEdit(s) });
    }
    items.push({ key: "duplicate", label: "설정 복제", icon: <RiFileCopy2Line size={16} />, onSelect: () => handleDuplicate(s) });
    if (canManage(s)) {
      if (st === "active") {
        items.push({
          key: "end",
          label: "종료 (새 입장 차단)",
          icon: <RiStopCircleLine size={16} />,
          onSelect: () => {
            if (confirm(`"${s.title}" 세션을 종료하시겠습니까? 종료된 세션은 새 입장이 차단됩니다.`)) {
              runAndReload(() => endSession(s.id), "종료에 실패했습니다.");
            }
          },
        });
      } else if (st === "ended") {
        items.push({
          key: "reopen",
          label: "다시 진행",
          icon: <RiPlayCircleLine size={16} />,
          onSelect: () => runAndReload(() => reopenSession(s.id), "상태 변경에 실패했습니다."),
        });
      }
      items.push(
        st === "archived"
          ? {
              key: "unarchive",
              label: "보관 해제",
              icon: <RiInboxUnarchiveLine size={16} />,
              onSelect: () => runAndReload(() => unarchiveSession(s), "보관 해제에 실패했습니다."),
            }
          : {
              key: "archive",
              label: "보관 (목록에서 숨김)",
              icon: <RiArchiveLine size={16} />,
              onSelect: () => runAndReload(() => archiveSession(s.id), "보관에 실패했습니다."),
            },
        { key: "delete", label: "삭제…", icon: <RiDeleteBinLine size={16} />, onSelect: () => setDeleteTarget(s), danger: true }
      );
    }
    return items;
  }

  const allSessions = list.status === "ready" ? list.sessions : [];
  const visibleSessions = sortSessions(filterSessions(allSessions, { query, status: statusFilter }), sortMode);
  const control =
    "touch-target h-10 px-3 text-sm text-ink bg-chalk-card border border-field-border rounded-full outline-none focus:border-graphite";

  // 인증된 Admin 대시보드
  return (
    <div className="flex flex-col min-h-screen">
      <Nav isAdmin />
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-6 py-8 md:py-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-graphite">세션 관리</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-text">
              <span>
                {session.user?.name} ({session.user?.email})
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-graphite text-chalk-card">
                {isSuper ? "최고 관리자" : "관리자"}
              </span>
              {isSuper && (
                <Link href="/admin/settings" className="inline-flex items-center gap-1 font-semibold text-blueprint hover:underline">
                  <RiShieldUserLine size={14} aria-hidden />
                  관리자 권한 설정
                </Link>
              )}
              <button onClick={() => signOut()} className="text-slate-text hover:text-graphite underline cursor-pointer">
                로그아웃
              </button>
            </p>
          </div>
          <Button onClick={() => setShowCreate((v) => !v)} aria-expanded={showCreate} className="shrink-0">
            <RiAddLine size={18} aria-hidden className="mr-1" />
            새 세션 만들기
          </Button>
        </div>

        {showCreate && (
          <Card className="p-6 mb-6">
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <SessionInfoFields idPrefix="create" {...form} onChange={(v) => setForm((f) => ({ ...f, ...v }))} />
              <div className="flex gap-3">
                <Button type="submit" disabled={creating || !form.title.trim()}>
                  {creating ? "만드는 중..." : "만들기"}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                  취소
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative basis-full sm:basis-auto flex-1 min-w-[200px]">
            <RiSearchLine size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-ash-text" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="세션명 검색"
              aria-label="세션명 검색"
              className={`${control} w-full pl-9`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SessionStatusFilter)}
            aria-label="상태 필터"
            className={control}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SessionSortMode)}
            aria-label="정렬"
            className={control}
          >
            {SORT_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {list.status === "loading" && (
          <p role="status" className="text-sm text-slate-text text-center py-12">
            세션 목록을 불러오는 중...
          </p>
        )}
        {list.status === "error" && (
          <div role="alert" className="text-center py-12">
            <p className="text-sm text-terracotta mb-3">세션 목록을 불러오지 못했습니다.</p>
            <Button variant="outlined" onClick={() => {
              setList({ status: "loading" });
              reloadSessions();
            }}>
              다시 시도
            </Button>
          </div>
        )}
        {list.status === "ready" && visibleSessions.length === 0 && (
          <p className="text-sm text-slate-text text-center py-12">
            {allSessions.length === 0 ? "아직 만든 세션이 없습니다. ‘새 세션 만들기’로 시작하세요." : "조건에 맞는 세션이 없습니다."}
          </p>
        )}

        <ul className="space-y-3" aria-label="세션 목록">
          {visibleSessions.map((s) => {
            const ownsSession = s.createdBy === firebaseUid;
            const st = sessionStatus(s);
            const count = participantCounts[s.id];
            const countText = count === undefined ? "집계 중" : count === "error" ? "확인 불가" : `${count}명`;
            return (
              <li key={s.id}>
                <Card
                  data-testid={`session-row-${s.id}`}
                  className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 ${st === "archived" ? "opacity-80" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-ink line-clamp-2">{s.title}</h2>
                      <span
                        title={STATUS_HELP[st]}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          st === "active" ? "bg-ok-bg text-sage" : st === "ended" ? "bg-linen text-slate-text" : "bg-vellum text-slate-text border border-silver-mist"
                        }`}
                      >
                        {STATUS_LABEL[st]}
                      </span>
                      {isSuper && !ownsSession && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blossom text-graphite">
                          다른 관리자
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-text">
                      <span>교육일 {formatEventDate(s.eventDate) || "미설정"}</span>
                      <span>생성일 {formatDate(s.createdAt) || "-"}</span>
                      <span>
                        코드 <span className="font-mono font-semibold text-ink">{s.code}</span>
                      </span>
                      <span title={METRICS.cumulative.help}>
                        {METRICS.cumulative.label} {countText}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button onClick={() => enterBoard(s.id)}>보드 열기</Button>
                    <Button variant="ghost" onClick={() => router.push(`/admin/report/${s.id}`)}>
                      보고서
                    </Button>
                    <Menu
                      label={`${s.title} 더보기`}
                      items={sessionMenu(s)}
                      triggerClassName="touch-target inline-flex items-center justify-center w-10 h-10 rounded-full border border-silver-mist text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer"
                      trigger={<RiMoreFill size={20} aria-hidden />}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        className="max-w-md"
        showClose={!deleting}
        labelledBy="delete-dialog-title"
      >
        {deleteTarget && (
          <div className="px-6 pb-6">
            <h2 id="delete-dialog-title" className="text-2xl font-bold text-graphite mb-3">
              세션 삭제
            </h2>
            <p className="text-sm text-ink mb-2">
              <span className="font-semibold">{deleteTarget.title}</span>
              <span className="text-slate-text"> · {deleteTarget.code}</span>
            </p>
            <p className="text-sm text-slate-text mb-4">
              포스트잇·댓글·대화·투표·참여자 기록이 모두 영구 삭제되며 복구할 수 없습니다. 업로드된 첨부파일 원본은
              저장소에 남습니다.
            </p>
            <div className="bg-buttercup border border-ochre/20 rounded-lg p-3 mb-5 space-y-2">
              <p className="text-sm text-ochre">
                <span className="font-semibold">나중에 다시 볼 수도 있다면 삭제 대신 보관하세요.</span> 보관하면 목록에서
                숨기고 새 입장을 막지만 데이터는 남습니다.
              </p>
              <button
                onClick={() => router.push(`/admin/report/${deleteTarget.id}`)}
                className="inline-flex items-center text-sm font-semibold text-ochre underline cursor-pointer hover:text-graphite"
              >
                삭제 전에 보고서 내려받기 →
              </button>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                취소
              </Button>
              {sessionStatus(deleteTarget) !== "archived" && (
                <Button
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    runAndReload(() => archiveSession(target.id), "보관에 실패했습니다.");
                  }}
                >
                  보관하기
                </Button>
              )}
              <Button onClick={handleConfirmDelete} disabled={deleting} className="bg-terracotta! hover:opacity-90">
                {deleting ? "삭제 중..." : "영구 삭제"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!editTarget} onClose={() => !savingEdit && setEditTarget(null)} className="max-w-md" labelledBy="edit-dialog-title">
        {editTarget && (
          <form onSubmit={handleSaveEdit} className="px-6 pb-6 flex flex-col gap-4">
            <h2 id="edit-dialog-title" className="text-2xl font-bold text-graphite">
              세션 정보 수정
            </h2>
            <SessionInfoFields idPrefix="edit" {...editForm} onChange={(v) => setEditForm((f) => ({ ...f, ...v }))} />
            <div className="flex justify-end gap-2">
              <Button variant="outlined" type="button" onClick={() => setEditTarget(null)} disabled={savingEdit}>
                취소
              </Button>
              <Button type="submit" disabled={savingEdit || !editForm.title.trim()}>
                {savingEdit ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!qrModal} onClose={() => setQrModal(null)} className="max-w-md" showClose label="입장 QR 코드">
        {qrModal && (
          <div className="px-8 pb-8 text-center">
            <p
              className="text-7xl text-graphite mb-6 font-mono font-bold"
              style={{ letterSpacing: "0.15em", lineHeight: 1.08 }}
              aria-label={`입장 코드 ${qrModal.code}`}
            >
              {qrModal.code}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR 이미지 */}
            <img src={qrModal.qrUrl} alt={`입장 QR 코드 (${qrModal.code})`} className="mx-auto mb-4" />
            <p className="text-sm text-slate-text mb-6">QR 스캔 또는 코드를 입력하여 참여</p>
            <div className="flex flex-col items-center gap-3">
              <Button variant="outlined" onClick={handleCopyJoinLink}>
                <span className="inline-flex items-center gap-1.5">
                  {linkCopied ? <RiCheckLine size={16} aria-hidden /> : <RiLinkM size={16} aria-hidden />}
                  {linkCopied ? "복사되었습니다!" : "입장 링크 복사하기"}
                </span>
              </Button>
              <Button onClick={() => enterBoard(qrModal.sessionId)}>보드 열기</Button>
              <Button variant="ghost" onClick={() => setQrModal(null)}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
