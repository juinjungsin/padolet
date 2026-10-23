import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { isSuperAdmin, isDelegatedAdmin } from "@/lib/firestore";

/**
 * 로컬 에뮬레이터 전용 관리자 로그인 — Google OAuth 없이 이메일만으로 로그인.
 * 에뮬레이터 모드 + 개발 서버일 때만 등록되며 운영 빌드(NODE_ENV=production)에는 존재하지 않는다.
 * 관리자 허용 목록 검사(signIn callback)는 그대로 적용된다.
 */
const EMULATOR_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_USE_EMULATOR === "1" && process.env.NODE_ENV !== "production";

const emulatorProviders = EMULATOR_LOGIN_ENABLED
  ? [
      CredentialsProvider({
        id: "emulator",
        name: "Emulator",
        credentials: { email: { type: "email" }, name: { type: "text" } },
        async authorize(credentials) {
          const email = credentials?.email?.trim().toLowerCase();
          if (!email) return null;
          return { id: `emu-${email}`, email, name: credentials?.name || email.split("@")[0] };
        },
      }),
    ]
  : [];

/**
 * 위임 관리자 허용 목록 확인.
 * 에뮬레이터 모드에서는 Next 서버 번들의 gRPC 연결이 에뮬레이터에 붙지 않아 REST로 조회한다
 * (admins 컬렉션은 공개 읽기). 운영 경로는 기존 SDK 조회 그대로.
 */
async function isAllowedDelegatedAdmin(email: string): Promise<boolean> {
  if (EMULATOR_LOGIN_ENABLED) {
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const port = process.env.NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT || "8080";
    const res = await fetch(
      `http://127.0.0.1:${port}/v1/projects/${project}/databases/(default)/documents/admins/${encodeURIComponent(email.toLowerCase())}`
    );
    return res.ok;
  }
  return isDelegatedAdmin(email);
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...emulatorProviders,
  ],
  session: {
    // 8시간 후 자동 만료 (강의 1회 분량 + 여유)
    maxAge: 60 * 60 * 8,
  },
  callbacks: {
    async signIn({ user }) {
      // super_admin 또는 등록된 admin만 로그인 허용
      const email = user.email;
      if (!email) return false;
      if (isSuperAdmin(email)) return true;
      try {
        return await isAllowedDelegatedAdmin(email);
      } catch (err) {
        // fail-closed — Firestore 조회 실패 시 로그인 거부
        console.error("[next-auth] admin allowlist lookup failed", err);
        return false;
      }
    },
    /**
     * Google id_token을 JWT에 보관 → session에 노출 → 클라이언트 FirebaseAuthSync가
     * signInWithCredential로 Firebase Auth 이중 로그인 트리거.
     *
     * Firestore Rules는 Firebase Auth의 request.auth.token.email로 관리자 판별하므로
     * NextAuth만으로는 write 불가.
     */
    async jwt({ token, account, user }) {
      // 에뮬레이터 로그인: Auth 에뮬레이터는 서명 없는 JSON id_token을 Google 자격증명으로 받아준다
      if (EMULATOR_LOGIN_ENABLED && account?.provider === "emulator" && user?.email) {
        token.googleIdToken = JSON.stringify({
          sub: user.id,
          email: user.email,
          email_verified: true,
          name: user.name,
        });
        token.googleIdTokenExpires = Date.now() + 3600 * 1000;
        return token;
      }
      if (account?.id_token) {
        token.googleIdToken = account.id_token;
        // Google id_token 유효기간(약 1시간)
        token.googleIdTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
      }
      // 클라이언트에서 Firebase Auth 이중 로그인에 사용
      // Session 타입에 인덱스 시그니처가 없어 unknown 경유 캐스팅 필요
      (session as unknown as Record<string, unknown>).googleIdToken = token.googleIdToken;
      (session as unknown as Record<string, unknown>).googleIdTokenExpires =
        token.googleIdTokenExpires;
      return session;
    },
  },
  pages: {
    signIn: "/admin",
  },
});

export { handler as GET, handler as POST };
