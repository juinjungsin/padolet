import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isSuperAdmin, isDelegatedAdmin } from "@/lib/firestore";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
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
        return await isDelegatedAdmin(email);
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
    async jwt({ token, account }) {
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
