"use client";

import { useEffect, useState } from "react";
import {
  AdminEntry,
  addAdmin,
  listAdmins,
  removeAdmin,
} from "@/lib/firestore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { RiDeleteBinLine, RiShieldUserLine } from "react-icons/ri";

interface Props {
  superAdminEmail: string;
}

const roleBadge = "ml-2 text-xs px-2 py-0.5 rounded-full font-semibold";

/** 관리자 권한 관리 — 최고 관리자 전용 (/admin/settings) */
export default function AdminManagementPanel({ superAdminEmail }: Props) {
  const [admins, setAdmins] = useState<AdminEntry[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    setAdmins(await listAdmins());
  }

  useEffect(() => {
    let cancelled = false;
    listAdmins()
      .then((list) => {
        if (!cancelled) setAdmins(list);
      })
      .catch(() => {
        if (!cancelled) setError("관리자 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("올바른 이메일 형식이 아닙니다.");
      return;
    }
    if (trimmed === superAdminEmail.toLowerCase()) {
      setError("이미 최고 관리자입니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addAdmin(trimmed, superAdminEmail);
      setEmail("");
      await reload();
    } catch {
      setError("추가에 실패했습니다.");
    }
    setBusy(false);
  }

  async function handleRemove(targetEmail: string) {
    if (!confirm(`"${targetEmail}" 관리자 권한을 회수하시겠습니까?`)) return;
    setBusy(true);
    try {
      await removeAdmin(targetEmail);
      await reload();
    } catch {
      setError("권한 회수에 실패했습니다.");
    }
    setBusy(false);
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <RiShieldUserLine size={18} aria-hidden className="text-graphite" />
        <h2 className="text-lg font-bold text-graphite">관리자 권한 관리</h2>
        <span className="text-xs bg-buttercup text-ochre px-2 py-0.5 rounded-full font-semibold">최고 관리자 전용</span>
      </div>
      <p className="text-sm text-slate-text mb-4">
        등록된 이메일은 padolet 관리자로 로그인해 본인이 만든 세션만 관리할 수 있습니다. 다른 관리자의 세션을 보거나
        삭제할 수는 없습니다.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-4">
        <label htmlFor="admin-email" className="sr-only">
          추가할 관리자 이메일
        </label>
        <Input
          id="admin-email"
          variant="contained"
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
        />
        <Button type="submit" disabled={busy || !email.trim()} className="shrink-0">
          관리자 추가
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-terracotta mb-2">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        <li className="flex flex-wrap items-center justify-between gap-2 border border-silver-mist rounded-lg px-3 py-2 bg-vellum">
          <span className="min-w-0">
            <span className="text-sm text-ink font-semibold">{superAdminEmail}</span>
            <span className={`${roleBadge} bg-graphite text-chalk-card`}>최고 관리자</span>
          </span>
          <span className="text-xs text-ash-text">변경 불가</span>
        </li>
        {admins === null && !error && (
          <li role="status" className="text-sm text-slate-text py-2">
            관리자 목록을 불러오는 중...
          </li>
        )}
        {admins?.length === 0 && <li className="text-sm text-slate-text py-2">등록된 일반 관리자가 없습니다.</li>}
        {admins?.map((a) => (
          <li
            key={a.email}
            className="flex flex-wrap items-center justify-between gap-2 border border-silver-mist rounded-lg px-3 py-2"
          >
            <span className="min-w-0">
              <span className="text-sm text-ink">{a.email}</span>
              <span className={`${roleBadge} bg-linen text-ink`}>관리자</span>
            </span>
            <button
              onClick={() => handleRemove(a.email)}
              disabled={busy}
              aria-label={`${a.email} 관리자 권한 회수`}
              className="touch-target inline-flex items-center gap-1 h-8 px-2 text-sm text-terracotta hover:bg-warn-bg rounded-full cursor-pointer"
            >
              <RiDeleteBinLine size={14} aria-hidden />
              권한 회수
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
