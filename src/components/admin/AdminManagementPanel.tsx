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

export default function AdminManagementPanel({ superAdminEmail }: Props) {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    const list = await listAdmins();
    setAdmins(list);
  }

  useEffect(() => {
    reload();
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
      setError("이미 super_admin입니다.");
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
    await removeAdmin(targetEmail);
    await reload();
    setBusy(false);
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <RiShieldUserLine size={18} className="text-graphite" />
        <h2 className="text-base font-semibold text-graphite">관리자 권한 관리</h2>
        <span className="ml-2 text-[10px] uppercase tracking-wider bg-buttercup text-ochre px-2 py-0.5 rounded-full font-semibold">
          SUPER_ADMIN ONLY
        </span>
      </div>
      <p className="text-xs text-slate-text mb-4">
        등록된 이메일은 padolet 관리자로 로그인하여 본인이 만든 세션만 관리할 수 있습니다. 다른 관리자의 세션을 보거나 삭제할 수는 없습니다.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <Input
          variant="contained"
          type="email"
          placeholder="example@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
        />
        <Button type="submit" disabled={busy || !email.trim()}>
          관리자 추가
        </Button>
      </form>
      {error && <p className="text-xs text-terracotta mb-2">{error}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between border border-silver-mist rounded-lg px-3 py-2 bg-vellum">
          <div>
            <span className="text-sm text-ink font-semibold">{superAdminEmail}</span>
            <span className="ml-2 text-[10px] uppercase tracking-wider bg-graphite text-chalk-card px-2 py-0.5 rounded-full font-semibold">
              SUPER
            </span>
          </div>
          <span className="text-xs text-ash-text">변경 불가</span>
        </div>
        {admins.length === 0 && (
          <p className="text-xs text-ash-text py-2">등록된 일반 관리자가 없습니다.</p>
        )}
        {admins.map((a) => (
          <div
            key={a.email}
            className="flex items-center justify-between border border-silver-mist rounded-lg px-3 py-2"
          >
            <div>
              <span className="text-sm text-ink">{a.email}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider bg-linen text-ink px-2 py-0.5 rounded-full font-semibold">
                ADMIN
              </span>
            </div>
            <button
              onClick={() => handleRemove(a.email)}
              disabled={busy}
              className="text-xs text-terracotta hover:text-graphite cursor-pointer flex items-center gap-1"
            >
              <RiDeleteBinLine size={12} />
              권한 회수
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
