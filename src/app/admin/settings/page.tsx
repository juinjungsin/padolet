"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import Nav from "@/components/layout/Nav";
import Card from "@/components/ui/Card";
import AdminManagementPanel from "@/components/admin/AdminManagementPanel";
import { isSuperAdmin, SUPER_ADMIN_EMAIL } from "@/lib/firestore";
import { RiArrowLeftLine } from "react-icons/ri";

/** 관리자 권한 설정 — 세션 목록과 분리된 최고 관리자 전용 화면 (요구사항 4.3) */
export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  // admins 쓰기 권한은 Firebase Auth 토큰 이메일로 판별 — 이중 로그인 완료 후 화면 표시
  const [fbReady, setFbReady] = useState(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), (u) => setFbReady(!!u && !u.isAnonymous));
    return () => unsub();
  }, []);

  if (status === "loading" || (session && isSuperAdmin(session.user?.email) && !fbReady)) {
    return (
      <div role="status" className="flex-1 flex items-center justify-center text-slate-text">
        불러오는 중...
      </div>
    );
  }

  const allowed = isSuperAdmin(session?.user?.email);

  return (
    <div className="flex flex-col min-h-screen">
      <Nav isAdmin={!!session} />
      <div className="max-w-[800px] mx-auto w-full px-4 md:px-6 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 mb-4 text-sm font-semibold text-slate-text hover:text-graphite"
        >
          <RiArrowLeftLine size={16} aria-hidden />
          세션 관리로 돌아가기
        </Link>
        <h1 className="text-3xl font-bold text-graphite mb-6">관리자 설정</h1>
        {allowed ? (
          <AdminManagementPanel superAdminEmail={SUPER_ADMIN_EMAIL} />
        ) : (
          <Card className="p-8 text-center">
            <p className="text-base font-semibold text-graphite mb-2">최고 관리자만 볼 수 있는 화면입니다.</p>
            <p className="text-sm text-slate-text">관리자 권한이 필요하면 최고 관리자({SUPER_ADMIN_EMAIL})에게 문의하세요.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
