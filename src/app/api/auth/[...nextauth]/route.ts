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
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/admin",
  },
});

export { handler as GET, handler as POST };
