import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { AppShell, type AppShellUser } from "@/components/layout/app-shell";
import { NavigationTransitionProvider } from "@/components/navigation/navigation-transition-provider";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRankSummary } from "@/lib/rank/queries";
import "./globals.css";

// Google Fonts CDN에 대한 render-blocking @import 대신 next/font로 셀프 호스팅한다.
// .font-archivo 유틸 클래스가 참조하는 --font-archivo 변수를 채운다.
const archivo = Archivo({
  weight: ["700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "MINION",
  description: "LCK 통합 허브와 팀별 팬 사이트 MVP",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  let shellUser: AppShellUser = null;
  if (user) {
    const summary = await getRankSummary(user.id);
    shellUser = { nickname: user.nickname, tier: summary.tier, lp: summary.lp };
  }

  return (
    <html lang="ko" suppressHydrationWarning className={archivo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('minion-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()` }} />
      </head>
      <body>
        <NavigationTransitionProvider>
          <AppShell currentUser={shellUser}>{children}</AppShell>
        </NavigationTransitionProvider>
      </body>
    </html>
  );
}
