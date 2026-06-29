import type { Metadata } from "next";
import { AppShell, type AppShellUser } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRankSummary } from "@/lib/rank/queries";
import "./globals.css";

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
    shellUser = { nickname: user.nickname, tier: summary.tier };
  }

  return (
    <html lang="ko">
      <body>
        <AppShell currentUser={shellUser}>{children}</AppShell>
      </body>
    </html>
  );
}
