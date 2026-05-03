import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import AuthProvider from "@/components/auth/AuthProvider";
import Footer from "@/components/layout/Footer";
import AgentationToolbar from "@/components/dev/AgentationToolbar";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "padolet",
  description: "교육용 실시간 커뮤니케이션 보드",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#f9efe4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${jakarta.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased bg-parchment text-ink">
        <AuthProvider>
          {children}
          <Footer />
        </AuthProvider>
        <AgentationToolbar />
      </body>
    </html>
  );
}
