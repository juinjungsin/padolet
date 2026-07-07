"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import FirebaseAuthSync from "./FirebaseAuthSync";

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {/* NextAuth 세션 → Firebase Auth 이중 로그인 동기화 (관리자 전용) */}
      <FirebaseAuthSync />
      {children}
    </SessionProvider>
  );
}
