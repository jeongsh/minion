import type { Metadata } from "next";
import Script from "next/script";
import { AppShell, type AppShellUser } from "@/components/layout/app-shell";
import { NavigationTransitionProvider } from "@/components/navigation/navigation-transition-provider";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTeams } from "@/lib/data/lck";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { getRankSummary } from "@/lib/rank/queries";
import { siteBaseUrl } from "@/lib/site";
import "./globals.css";

const themeInitScript = `
(function(){
  try {
    var storageKey = 'minion-theme';
    var savedTheme = localStorage.getItem(storageKey);
    var hasUserTheme = savedTheme === 'dark' || savedTheme === 'light';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = hasUserTheme ? savedTheme : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "MINION | LCK 팬 허브",
  description: "LCK 경기 일정, 팀과 선수 기록, 주간 리포트, 팬 평가와 커뮤니티를 한곳에서 확인하는 팬 허브입니다.",
  metadataBase: new URL(siteBaseUrl()),
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
    shellUser = {
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      tier: summary.tier,
      lp: summary.lp,
    };
  }
  const [followedTeamIds, shellTeams] = await Promise.all([getFollowedTeamIds(), getTeams()]);
  const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {adsenseClient ? <meta name="google-adsense-account" content={adsenseClient} /> : null}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {adsenseClient ? (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          />
        ) : null}
        <NavigationTransitionProvider>
          <AppShell currentUser={shellUser} followedTeamIds={followedTeamIds} shellTeams={shellTeams}>{children}</AppShell>
        </NavigationTransitionProvider>
      </body>
    </html>
  );
}
