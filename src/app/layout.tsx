import type { Metadata } from "next";
import localFont from "next/font/local";
import AuthProvider from "@/components/auth/AuthProvider";
import Footer from "@/components/layout/Footer";
import AgentationToolbar from "@/components/dev/AgentationToolbar";
import "./globals.css";

const wantedSans = localFont({
  src: "../../public/fonts/wanted-sans/WantedSansVariable.woff2",
  variable: "--font-wanted-sans",
  weight: "400 1000",
  style: "normal",
  display: "swap",
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
  themeColor: "#f6f8fb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${wantedSans.variable} h-full`}>
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
