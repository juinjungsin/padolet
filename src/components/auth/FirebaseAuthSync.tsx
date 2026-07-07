"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { signInWithGoogleCredential } from "@/lib/firebase";

/**
 * NextAuth 세션에 담긴 Google id_token을 감지해서 Firebase Auth로 이중 로그인.
 *
 * 관리자 흐름 전용 — 참여자는 /join 페이지에서 signInAnonymously로 별도 처리.
 *
 * 주의: Google id_token은 유효기간 1시간. NextAuth 세션(8시간)이 살아있어도
 * Firebase 인증이 만료될 수 있음. 만료 감지 시 재로그인 유도 필요 (추후 개선).
 */
export default function FirebaseAuthSync() {
  const { data: session } = useSession();
  // Session 타입에 인덱스 시그니처가 없어 unknown 경유 캐스팅 필요
  const idToken = (session as unknown as Record<string, unknown> | null)?.googleIdToken as
    | string
    | undefined;

  useEffect(() => {
    if (!idToken) return;
    signInWithGoogleCredential(idToken).catch((err) => {
      console.error("[FirebaseAuthSync] Firebase 이중 로그인 실패", err);
    });
  }, [idToken]);

  return null;
}
