"use client";

import { MobileNavigation, MobileLocalNavigation, hasMobileLocalNavigation } from "@/components/layout/mobile-navigation";
import { DesktopNavigation } from "@/components/layout/desktop-navigation";

import { MessageIndicator } from "@/components/messages/message-indicator";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bug,
  ChevronDown,
  ChevronLeft,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { THEME_STORAGE_KEY, applyTheme, saveTheme } from "@/components/layout/theme-toggle";
import { HeaderSearch } from "@/components/layout/header-search";
import { SiteFooter } from "@/components/layout/site-footer";
import { DesktopAdRails } from "@/components/ads/desktop-ad-rails";
import { TournamentEntryFallback } from "@/components/navigation/tournament-content-cache";
import { useMatchActivity } from "@/components/match-activity/use-match-activity";
import { RatingOpenCard } from "@/components/match-activity/rating-open-card";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { NotificationContext } from "@/components/notifications/notification-context";
import { RankAvatar } from "@/components/rank/rank-avatar";
import { TeamLogo } from "@/components/ui/team-logo";
import { teams as fallbackTeams } from "@/lib/team-themes";
import type { LiveMatchActivity } from "@/lib/match-activity";
import type { Team } from "@/lib/types";
import type { Tier } from "@/lib/rank/config";
import type { NotificationPreferences } from "@/lib/notifications";

export type AppShellUser = {
  id: string;
  nickname: string | null;
  profileImageUrl: string | null;
  tier: Tier;
  lp: number;
} | null;


function LiveMatchCard({ match, onOpen, onClose }: { match: LiveMatchActivity; onOpen: () => void; onClose: () => void }) {
  return (
    <aside className="dismissible-activity-card match-activity-card relative flex min-h-[52px] w-full items-stretch rounded-xl border border-[var(--accent)] bg-[var(--ui-surface)] shadow-[0_8px_24px_rgba(15,23,42,0.14)] dark:bg-[var(--ui-surface-muted)]">
      <Link
        href={match.href}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-l-xl px-4 py-2.5 transition-colors hover:bg-[var(--ui-card-hover)]"
        aria-label={`${match.teamA.shortName} 대 ${match.teamB.shortName} 라이브 경기 바로 보기`}
      >
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#e51643]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full !bg-[#ff3158]" />
          LIVE
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[14px] font-bold text-[var(--ui-ink)]">
          <span className="truncate">{match.teamA.shortName}</span>
          {match.teamA.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.teamA.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
          ) : null}
          <b className="rounded-md bg-[var(--ui-ink)] px-2 py-1 text-[13px] font-black tabular-nums leading-none text-[var(--ui-surface)]">{match.teamAScore ?? 0}:{match.teamBScore ?? 0}</b>
          {match.teamB.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.teamB.logoUrl} alt="" className="h-5 w-5 shrink-0 object-contain" />
          ) : null}
          <span className="truncate">{match.teamB.shortName}</span>
        </span>
      </Link>
      <button type="button" onClick={onClose} className="activity-card-close grid w-10 shrink-0 place-items-center text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]" aria-label="라이브 알림 닫기">
        <X size={16} />
      </button>
    </aside>
  );
}

function focusRouteMeta(pathname: string) {
  if (pathname === "/login") return { title: "로그인", backHref: "/" };
  if (pathname === "/signup") return { title: "회원가입", backHref: "/login" };
  if (pathname === "/minicons/apply") return { title: "미니콘 신청", backHref: "/minicons" };
  if (pathname === "/me/minicons") return { title: "내 미니콘", backHref: "/minicons" };
  if (pathname === "/me/profile") return { title: "프로필 관리", backHref: "/me" };
  if (pathname === "/me/settings") return { title: "설정", backHref: "/me" };
  const snapshotRoute = pathname.match(/^\/matches\/([^/]+)\/sets\/([^/]+)\/snapshot$/);
  if (snapshotRoute) {
    // 스냅샷은 매치 상세의 "평가" 탭(쿼리스트링 포함)처럼 URL만으로는 복원 못 하는
    // 곳에서도 진입한다. backHref는 히스토리가 없을 때(직접 방문/새 탭)의 대비용
    // 폴백이고, 있으면 실제 뒤로가기(브라우저 히스토리)로 원래 있던 화면 그대로 돌아간다.
    return {
      title: "평점 공유 이미지",
      backHref: `/matches/${snapshotRoute[1]}?tab=rating&set=${snapshotRoute[2]}`,
      preferHistoryBack: true,
    };
  }
  if (/^\/community\/(new|[^/]+\/new|post\/[^/]+\/edit)$/.test(pathname)) return { title: pathname.endsWith("/edit") ? "글 수정" : "글쓰기", backHref: "/community" };
  const fanWrite = pathname.match(/^\/fan\/([^/]+)\/community\/(new|[^/]+\/new|post\/[^/]+\/edit)$/);
  if (fanWrite) return { title: pathname.endsWith("/edit") ? "글 수정" : "글쓰기", backHref: `/fan/${fanWrite[1]}/community` };
  return null;
}

// 모바일 웹에서 로컬 탭 대신 뒤로가기 헤더를 쓰는 상세·기타 페이지. 데스크톱 헤더는 그대로 둔다.
function mobileBackRouteMeta(pathname: string) {
  if (/^\/community\/post\/[^/]+$/.test(pathname)) return { title: "LCK", backHref: "/community", close: true };
  if (/^\/matches\/[^/]+$/.test(pathname)) return { title: "경기", backHref: "/schedule" };
  if (/^\/players\/[^/]+$/.test(pathname)) return { title: "선수", backHref: "/players" };
  if (/^\/champions\/[^/]+$/.test(pathname)) return { title: "챔피언", backHref: "/champions" };
  if (pathname === "/predictions/report") return { title: "내 예측 리포트", backHref: "/predictions" };
  if (pathname === "/me") return { title: "마이", backHref: "/" };
  if (pathname === "/me/messages") return { title: "쪽지함", backHref: "/me" };
  if (pathname === "/teams") return { title: "팀", backHref: "/" };
  if (pathname === "/minicons") return { title: "미니콘", backHref: "/" };
  if (/^\/community\/user\/[^/]+$/.test(pathname)) return { title: "활동", backHref: "/community" };
  if (pathname === "/community/rules") return { title: "커뮤니티 이용 규칙", backHref: "/community" };
  if (pathname === "/support") return { title: "고객센터", backHref: "/" };
  if (pathname === "/support/new") return { title: "문의하기", backHref: "/support" };
  if (/^\/support\/[^/]+$/.test(pathname)) return { title: "문의 상세", backHref: "/support" };
  if (pathname === "/about") return { title: "서비스 소개", backHref: "/" };
  if (pathname === "/policies") return { title: "정책 안내", backHref: "/" };
  if (pathname === "/privacy") return { title: "개인정보처리방침", backHref: "/policies" };
  if (pathname === "/terms") return { title: "이용약관", backHref: "/policies" };
  if (pathname === "/advertising") return { title: "광고 및 제휴 문의", backHref: "/policies" };
  return null;
}

export function AppShell({
  children,
  currentUser = null,
  isAdminUser = false,
  pendingSupportInquiryCount = 0,
  followedTeamIds = [],
  favoriteTeamId = null,
  shellTeams = fallbackTeams,
  notificationPreferences,
}: {
  children: React.ReactNode;
  currentUser?: AppShellUser;
  isAdminUser?: boolean;
  pendingSupportInquiryCount?: number;
  followedTeamIds?: string[];
  favoriteTeamId?: string | null;
  shellTeams?: Team[];
  notificationPreferences: NotificationPreferences;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [teamSwitcherOpen, setTeamSwitcherOpen] = useState(false);
  const [primaryHeaderVisible, setPrimaryHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const fanKey = pathname.startsWith("/fan/") ? pathname.split("/")[2] : null;
  const fanRoute = pathname.startsWith("/fan/");
  const hubPostDetail = /^\/community\/post\/[^/]+$/.test(pathname);
  const fanPostDetail = pathname.match(/^\/fan\/([^/]+)\/community\/post\/[^/]+$/);
  const communityPostDetail = hubPostDetail || Boolean(fanPostDetail);
  const focus = focusRouteMeta(pathname);
  const focusRoute = Boolean(focus);
  const followedTeamIdSet = new Set(followedTeamIds);
  const followedTeams = shellTeams.filter((team) => followedTeamIdSet.has(team.id) || followedTeamIdSet.has(team.fanSiteHost));
  const currentFanTeam = fanKey ? shellTeams.find((team) => team.fanSiteHost === fanKey || team.slug === fanKey) : null;
  const mobileBack = focusRoute ? null : fanPostDetail
    ? { title: currentFanTeam?.shortName ?? fanPostDetail[1].toUpperCase(), backHref: `/fan/${fanPostDetail[1]}/community`, close: true }
    : fanRoute ? null : mobileBackRouteMeta(pathname);
  const showHubLocalNavigation = !fanRoute && !focusRoute && !mobileBack && hasMobileLocalNavigation(pathname);
  const favoriteTeam = favoriteTeamId ? shellTeams.find((team) => team.id === favoriteTeamId) : null;
  const {
    liveCard,
    dismissLiveCard,
    ratingCard,
    dismissRatingCard,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    removeNotification,
    clearNotifications,
    mutateCommunityActivity,
  } = useMatchActivity(Boolean(currentUser), notificationPreferences, currentUser?.id ?? "guest");
  const closeLiveActivity = () => {
    if (!liveCard) return;
    markNotificationRead(`match-live:${liveCard.id}`);
    dismissLiveCard();
  };
  const closeRatingActivity = () => {
    if (!ratingCard) return;
    markNotificationRead(`rating-open:${ratingCard.id}`);
    dismissRatingCard();
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--shell-toast-tablet-lnb-width",
      focusRoute ? "0px" : "152px",
    );
    root.style.setProperty(
      "--shell-toast-desktop-lnb-width",
      focusRoute ? "0px" : "152px",
    );
  }, [focusRoute]);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const resetFrame = window.requestAnimationFrame(() => {
      setPrimaryHeaderVisible(window.scrollY < 16);
      setTeamSwitcherOpen(false);
    });

    const updateHeader = () => {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollY.current;

      if (currentY < 16) setPrimaryHeaderVisible(true);
      else if (delta > 4) setPrimaryHeaderVisible(false);
      else if (delta < -4) setPrimaryHeaderVisible(true);

      lastScrollY.current = currentY;
    };

    document.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => {
      window.cancelAnimationFrame(resetFrame);
      document.removeEventListener("scroll", updateHeader);
      window.removeEventListener("scroll", updateHeader);
    };
  }, [pathname]);

  useEffect(() => {
    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const followBrowserTheme = (event: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === "dark" || savedTheme === "light") return;
      applyTheme(event.matches ? "dark" : "light");
    };

    colorSchemeQuery.addEventListener("change", followBrowserTheme);
    return () => colorSchemeQuery.removeEventListener("change", followBrowserTheme);
  }, []);

  const toggleDarkMode = () => {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    saveTheme(nextTheme);
  };


  return (
    <div
      className="text-[#141517]"
      data-app-shell
      style={{ "--shell-mobile-header-offset": mobileBack ? "48px" : primaryHeaderVisible ? "56px" : "0px","--shell-local-nav-height": fanRoute || showHubLocalNavigation ? "44px" : "0px" } as React.CSSProperties}
    >
      {focus ? (
        <header className="fixed inset-x-0 top-0 z-50 grid h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-[#e8e8eb] bg-[var(--page-background)] px-3 md:h-16 dark:border-[var(--ui-border)]">
          <Link
            href={focus.backHref}
            onClick={
              focus.preferHistoryBack
                ? (event) => {
                    if (window.history.length > 1) {
                      event.preventDefault();
                      router.back();
                    }
                  }
                : undefined
            }
            className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[var(--ui-card-hover)]"
            aria-label="이전 화면"
          >
            <ChevronLeft size={22} />
          </Link>
          <p
            className={`font-paperozi truncate text-center font-bold leading-tight text-[var(--ui-ink)] md:font-normal ${
              pathname === "/login" || pathname === "/signup"
                ? "text-[16px] md:text-xl lg:text-xl"
                : "text-[16px] md:text-[24px] lg:text-[28px]"
            }`}
          >
            {focus.title}
          </p>
          <span aria-hidden="true" />
        </header>
      ) : (
      <header className={`fixed inset-x-0 top-0 z-50 flex items-center border-b border-[#e8e8eb] bg-[var(--page-background)] px-3 transition-transform duration-200 sm:px-4 md:h-16 md:translate-y-0 dark:border-[var(--ui-border)] ${mobileBack ? "h-12" : "h-14 sm:h-16"} ${mobileBack || primaryHeaderVisible ? "translate-y-0" : "-translate-y-full"}`}>
        {mobileBack ? (
          <div className="relative flex w-full items-center justify-center md:hidden">
            <Link
              href={mobileBack.backHref}
              onClick={(event) => {
                if (window.history.length > 1) {
                  event.preventDefault();
                  router.back();
                }
              }}
              className="absolute left-0 grid h-11 w-11 place-items-center rounded-xl hover:bg-[var(--ui-card-hover)]"
              aria-label={mobileBack.close ? "게시글 닫기" : "이전 화면"}
            >
              {mobileBack.close ? <X size={22} strokeWidth={1.8} /> : <ChevronLeft size={22} />}
            </Link>
            <p className="font-paperozi max-w-[70vw] truncate text-center text-[16px] font-bold text-[var(--ui-ink)]">{mobileBack.title}</p>
          </div>
        ) : null}
        <div className={mobileBack ? "hidden md:contents" : "contents"}>
        {fanRoute ? (
          <div className="relative flex min-w-0 flex-1 items-center md:hidden">
            <button type="button" onClick={() => setTeamSwitcherOpen((value) => !value)} className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-1.5 text-[16px] font-bold text-[var(--ui-ink)]" aria-expanded={teamSwitcherOpen} aria-haspopup="menu" aria-label="팀 전환">
              {currentFanTeam ? <TeamLogo team={currentFanTeam} size="h-7 w-7" themeAware /> : null}
              <span className="truncate">{currentFanTeam?.shortName ?? fanKey?.toUpperCase()}</span><ChevronDown size={16} className={`shrink-0 transition ${teamSwitcherOpen ? "rotate-180" : ""}`} />
            </button>
            {teamSwitcherOpen ? (
              <div role="menu" className="absolute left-0 top-[48px] z-50 w-56 overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-xl">
                {shellTeams.map((team) => <Link key={team.id} role="menuitem" href={`/fan/${team.fanSiteHost}`} onClick={() => setTeamSwitcherOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-[var(--ui-card-hover)]"><TeamLogo team={team} size="h-7 w-7" themeAware /><span className="truncate">{team.shortName}</span></Link>)}
              </div>
            ) : null}
          </div>
        ) : null}
        <Link href="/" className={`ml-1.5 shrink-0 text-[22px] font-black tracking-[-0.06em] text-[#18191c] sm:ml-2 sm:text-[25px] dark:text-white ${fanRoute ? "hidden md:block" : "block"}`}>
          <BrandLogo accentColor={currentFanTeam?.primaryColor} className="w-16 sm:w-24" priority />
        </Link>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden items-center justify-center min-[1200px]:flex"
          style={{ left: focusRoute ? 0 : 56 }}
        >
          <HeaderSearch className="pointer-events-auto w-[480px]" />
        </div>
        <button type="button" data-notification-trigger="" onClick={() => setNotificationPanelOpen((open) => !open)} aria-expanded={notificationPanelOpen} className="relative ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#62666d] transition hover:bg-[var(--ui-card-hover)] dark:text-[#a7acb5]" aria-label={`알림${unreadNotificationCount > 0 ? `, 읽지 않은 알림 ${unreadNotificationCount}개` : ""}`} aria-haspopup="dialog">
          <Bell size={20} />
          {unreadNotificationCount > 0 ? <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-0.5 text-[12px] font-medium leading-none text-white" aria-hidden>{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span> : null}
        </button>
        {currentUser ? <MessageIndicator /> : null}
        {process.env.NODE_ENV !== "production" && currentUser ? (
          <Link
            href="/?onboarding=debug&next=%2Fme"
            className="ml-1 flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-[var(--accent)] px-2.5 text-[13px] font-medium text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
            aria-label="온보딩 테스트 열기"
            title="온보딩 테스트 열기"
          >
            <Bug size={16} />
            <span className="hidden sm:inline">온보딩 테스트</span>
          </Link>
        ) : null}
        <button type="button" onClick={toggleDarkMode} className="mr-2 hidden h-11 w-11 shrink-0 place-items-center md:grid rounded-xl text-[#62666d] transition hover:bg-[var(--ui-card-hover)] sm:mr-2 dark:bg-[rgba(0,0,0,0)] dark:text-[#a7acb5]" aria-label="색상 모드 전환" title="색상 모드 전환">
          <Moon size={20} className="dark:hidden" />
          <Sun size={20} className="hidden dark:block" />
        </button>
        {isAdminUser ? (
          <Link
            href="/admin"
            className={`relative mr-2 hidden h-11 items-center rounded-xl border bg-white px-3 text-[13px] font-bold text-[#18191c] transition hover:bg-[var(--ui-card-hover)] sm:inline-flex dark:bg-[#30343b] dark:text-white ${
              pendingSupportInquiryCount > 0 ? "border-red-500" : "border-[#d9dce1] dark:border-[var(--ui-border)]"
            }`}
          >
            어드민
            {pendingSupportInquiryCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[12px] font-medium leading-none text-white">
                {pendingSupportInquiryCount > 9 ? "9+" : pendingSupportInquiryCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        {currentUser ? (
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Link href="/me" prefetch={true} className="flex min-h-11 min-w-0 max-w-[126px] items-center gap-1.5 text-[13px] font-bold sm:max-w-none sm:gap-2 sm:text-sm">
              <RankAvatar
                tier={currentUser.tier}
                src={currentUser.profileImageUrl}
                fallback={currentUser.nickname ?? "MY"}
                className="scale-[0.875] sm:scale-100"
              />
            </Link>
          </div>
        ) : (
          <Link href="/login" className="flex min-h-11 items-center rounded-xl bg-[#141517] px-3 py-2 text-[13px] font-bold text-white sm:px-4 sm:text-sm">로그인</Link>
        )}
        </div>
      </header>
      )}

      {!focusRoute ? <DesktopNavigation pathname={pathname} favoriteTeam={favoriteTeam} followedTeams={followedTeams} teams={shellTeams} /> : null}

      <div className={`ad-rail-layout flex flex-col md:pt-16 ${focusRoute || mobileBack ? "pt-12" : "pt-14 sm:pt-16"} ${focusRoute ? "" : "md:pl-[152px]"}`}>
        {!focusRoute ? <DesktopAdRails /> : null}
        <div className={`${!focusRoute && !communityPostDetail ? "compact-hub-content pb-0" : "pb-0"}`} data-shell-content={!focusRoute && !communityPostDetail ? "compact-hub" : undefined}>
          {showHubLocalNavigation ? <MobileLocalNavigation pathname={pathname} /> : null}
          {pathname === "/tournaments" || pathname.startsWith("/tournaments/") ? (
            <div className="tournament-entry">
              <TournamentEntryFallback />
              <div className="tournament-entry-content">{children}</div>
            </div>
          ) : <NotificationContext value={{ notifications, onRead: markNotificationRead, onRemove: removeNotification, onReadAll: () => mutateCommunityActivity("PATCH"), onClear: () => mutateCommunityActivity("DELETE") }}>{children}</NotificationContext>}
        </div>
        {focusRoute ? (
          <div className="hidden md:block"><SiteFooter accentColor={currentFanTeam?.primaryColor} /></div>
        ) : (
          <SiteFooter accentColor={currentFanTeam?.primaryColor} />
        )}
      </div>

      {!focusRoute && !communityPostDetail ? <MobileNavigation key={pathname} pathname={pathname} favoriteTeam={favoriteTeam} followedTeams={followedTeams} teams={shellTeams} /> : null}

      <NotificationPanel
        open={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotificationCount}
        onRead={markNotificationRead}
        onReadAll={markAllNotificationsRead}
        onRemove={removeNotification}
        onClear={clearNotifications}
      />
      {currentUser && (liveCard || ratingCard) ? (
        <div className="fixed bottom-5 right-5 z-[60] hidden w-[390px] flex-col gap-2 min-[1200px]:flex">
          {liveCard ? <LiveMatchCard match={liveCard} onOpen={closeLiveActivity} onClose={closeLiveActivity} /> : null}
          {ratingCard ? <RatingOpenCard rating={ratingCard} onOpen={closeRatingActivity} onClose={closeRatingActivity} /> : null}
        </div>
      ) : null}
    </div>
  );
}
