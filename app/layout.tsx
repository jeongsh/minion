import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AppShell, type AppShellUser } from "@/components/layout/app-shell";
import { NavigationTransitionProvider } from "@/components/navigation/navigation-transition-provider";
import { ToastProvider } from "@/components/ui/toast";
import { SpoilerFreeProvider } from "@/lib/spoiler-free/spoiler-free-context";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { countOpenSupportInquiries } from "@/lib/data/support-admin";
import { getTeams } from "@/lib/data/lck";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { getFavoriteTeamId } from "@/lib/fan/favorite-team";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
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

const defaultTitle = "MINION | LCK 팬 허브";
const defaultDescription = "LCK 경기 일정, 팀과 선수 기록, 주간 리포트, 팬 평가와 커뮤니티를 한곳에서 확인하는 팬 허브입니다.";

export const metadata: Metadata = {
  title: defaultTitle,
  description: defaultDescription,
  metadataBase: new URL(siteBaseUrl()),
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    siteName: "MINION",
    images: [{ url: "/images/minion.png", width: 1408, height: 768 }],
  },
  verification: {
    other: { "naver-site-verification": "e5b9086e86ccaedc10305bf4dc5325f6051a1a05" },
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/images/minion.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const isAdminUser = user ? await isCurrentUserAdmin() : false;

  let shellUser: AppShellUser = null;
  if (user) {
    const summary = await getRankSummary(user.id);
    shellUser = {
      id: user.id,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      tier: summary.tier,
      lp: summary.lp,
    };
  }
  const [followedTeamIds, favoriteTeamId, shellTeams, notificationPreferences, pendingSupportInquiryCount] = await Promise.all([
    // 로그인한 유저에게만 "내 팀"을 보여준다 — 비로그인 상태의 쿠키 기반 팔로우는 사이드바에 노출하지 않는다.
    user ? getFollowedTeamIds() : Promise.resolve([]),
    getFavoriteTeamId(),
    getTeams(),
    getNotificationPreferences(),
    isAdminUser ? countOpenSupportInquiries() : Promise.resolve(0),
  ]);
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
        <ToastProvider>
          <SpoilerFreeProvider>
            <NavigationTransitionProvider>
              <AppShell
                key={user?.id ?? "guest"}
                currentUser={shellUser}
                isAdminUser={isAdminUser}
                pendingSupportInquiryCount={pendingSupportInquiryCount}
                followedTeamIds={followedTeamIds}
                favoriteTeamId={favoriteTeamId}
                shellTeams={shellTeams}
                notificationPreferences={notificationPreferences}
              >
                {children}
              </AppShell>
            </NavigationTransitionProvider>
          </SpoilerFreeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
