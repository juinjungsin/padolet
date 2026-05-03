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
      } catch {
        // Firestore 조회 실패 시 일단 허용 (admin 페이지에서 다시 권한 체크)
        // 차단을 더 엄격하게 하려면 false 반환
        return true;
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
