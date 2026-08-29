"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bug,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Coins,
  Crown,
  Heart,
  Home,
  Menu,
  Moon,
  Rss,
  Shield,
  Sparkles,
  Sun,
  Swords,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { FanTeamPicker } from "@/components/layout/fan-team-picker";
import { HeaderSearch } from "@/components/layout/header-search";
import { SiteFooter } from "@/components/layout/site-footer";
import { useMatchActivity } from "@/components/match-activity/use-match-activity";
import { RatingOpenCard } from "@/components/match-activity/rating-open-card";
import { NotificationPanel } from "@/components/notifications/notification-panel";
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

const THEME_STORAGE_KEY = "minion-theme";

function applyTheme(theme: "dark" | "light") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

const desktopNav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/schedule", label: "일정 및 매치", icon: CalendarDays },
  // /tournaments는 매번 오늘 날짜 기준으로 목적지가 바뀌는 완전 동적 리다이렉트라
  // 프리페치가 무의미하고, 프리페치 응답과 클릭 시 실제 응답이 같은 URL로 중복
  // 도착하면서 라우터 완료 감지(usePathname 기반)가 첫 응답만 보고 로딩을 조기
  // 종료시켜 "블랭크 후 뒤늦게 렌더링"으로 보이는 문제가 있었다.
  { href: "/tournaments", label: "대회", icon: Swords, prefetch: false },
  { href: "/predictions", label: "승부예측", icon: Sparkles },
  { href: "/players", label: "선수", icon: UserRound },
  { href: "/champions", label: "챔피언", icon: Crown },
  { href: "/news", label: "뉴스", icon: Rss },
  { href: "/community", label: "커뮤니티", icon: Users },
];

const compactNav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/schedule", label: "매치", icon: CalendarDays },
  { href: "/fan", label: "팬", icon: Heart },
  { href: "/teams", label: "팀", icon: Shield },
  { href: "/news", label: "뉴스", icon: Rss },
];

const hubLocalNav = [
  { href: "/", label: "메인" },
  { href: "/tournaments", label: "대회", prefetch: false },
  { href: "/predictions", label: "승부예측" },
  { href: "/players", label: "선수" },
  { href: "/champions", label: "챔피언" },
  { href: "/community", label: "커뮤니티" },
];

function isGlobalNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/fan") return pathname === "/fan" || pathname.startsWith("/fan/");
  if (href === "/schedule") {
    return pathname.startsWith("/schedule") || pathname.startsWith("/matches/") || pathname.startsWith("/tournaments") || pathname.startsWith("/predictions");
  }
  if (href === "/teams") return pathname === "/teams" || pathname.startsWith("/teams/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function LiveMatchCard({ match, onOpen, onClose }: { match: LiveMatchActivity; onOpen: () => void; onClose: () => void }) {
  return (
    <aside className="dismissible-activity-card match-activity-card relative flex min-h-[52px] w-full items-stretch rounded-xl border border-[var(--accent)] bg-[var(--ui-surface)] shadow-[0_8px_24px_rgba(15,23,42,0.14)] dark:bg-[var(--ui-surface-muted)]">
      <Link
        href={match.href}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-l-xl px-4 py-2.5 transition-colors hover:bg-[var(--ui-card-hover)]"
        aria-label={`${match.teamA.shortName} 대 ${match.teamB.shortName} 실시간 경기 바로 보기`}
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
  if (pathname === "/me/profile") return { title: "프로필 관리", backHref: "/me" };
  if (pathname === "/me/settings") return { title: "설정", backHref: "/me" };
  if (pathname.endsWith("/snapshot")) {
    // 스냅샷은 매치 상세의 "평가" 탭(쿼리스트링 포함)처럼 URL만으로는 복원 못 하는
    // 곳에서도 진입한다. backHref는 히스토리가 없을 때(직접 방문/새 탭)의 대비용
    // 폴백이고, 있으면 실제 뒤로가기(브라우저 히스토리)로 원래 있던 화면 그대로 돌아간다.
    return {
      title: "평점 공유 이미지",
      backHref: pathname.replace(/\/snapshot$/, ""),
      preferHistoryBack: true,
    };
  }
  if (/^\/community\/(new|[^/]+\/new|post\/[^/]+\/edit)$/.test(pathname)) return { title: pathname.endsWith("/edit") ? "글 수정" : "글쓰기", backHref: "/community" };
  const fanWrite = pathname.match(/^\/fan\/([^/]+)\/community\/(new|[^/]+\/new|post\/[^/]+\/edit)$/);
  if (fanWrite) return { title: pathname.endsWith("/edit") ? "글 수정" : "글쓰기", backHref: `/fan/${fanWrite[1]}/community` };
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
  const defaultTeamsOpen = !currentUser || followedTeamIds.length === 0;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [teamSwitcherOpen, setTeamSwitcherOpen] = useState(false);
  const [primaryHeaderVisible, setPrimaryHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [teamsOpen, setTeamsOpen] = useState(defaultTeamsOpen);
  const [lnbTooltip, setLnbTooltip] = useState<{ label: string; top: number } | null>(null);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const fanKey = pathname.startsWith("/fan/") ? pathname.split("/")[2] : null;
  const fanRoute = pathname.startsWith("/fan/");
  const hubPostDetail = /^\/community\/post\/[^/]+$/.test(pathname);
  const fanPostDetail = pathname.match(/^\/fan\/([^/]+)\/community\/post\/[^/]+$/);
  const communityPostDetail = hubPostDetail || Boolean(fanPostDetail);
  const focus = focusRouteMeta(pathname);
  const focusRoute = Boolean(focus);
  const compactHubShell = !fanRoute && !focusRoute;
  const showHubLocalNavigation = compactHubShell && !communityPostDetail && pathname !== "/fan" && !pathname.startsWith("/admin");
  const followedTeamIdSet = new Set(followedTeamIds);
  const followedTeams = shellTeams.filter((team) => followedTeamIdSet.has(team.id) || followedTeamIdSet.has(team.fanSiteHost));
  const channelTeams = shellTeams.filter((team) => !followedTeamIdSet.has(team.id) && !followedTeamIdSet.has(team.fanSiteHost));
  const currentFanTeam = fanKey ? shellTeams.find((team) => team.fanSiteHost === fanKey || team.slug === fanKey) : null;
  const favoriteTeam = favoriteTeamId ? shellTeams.find((team) => team.id === favoriteTeamId) : null;
  const communityPostTitle = fanPostDetail ? (currentFanTeam?.shortName ?? fanPostDetail[1].toUpperCase()) : "LCK";
  const communityPostBackHref = fanPostDetail ? `/fan/${fanPostDetail[1]}/community` : "/community";
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
      compactHubShell && !mobileMenuOpen ? "64px" : "0px",
    );
    root.style.setProperty(
      "--shell-toast-desktop-lnb-width",
      focusRoute ? "0px" : "56px",
    );
  }, [compactHubShell, focusRoute, mobileMenuOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1200px)");
    const closeMobileMenu = () => {
      if (desktopQuery.matches) setMobileMenuOpen(false);
    };
    closeMobileMenu();
    desktopQuery.addEventListener("change", closeMobileMenu);
    return () => desktopQuery.removeEventListener("change", closeMobileMenu);
  }, []);

  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const resetFrame = window.requestAnimationFrame(() => {
      setPrimaryHeaderVisible(window.scrollY < 16);
      setTeamSwitcherOpen(false);
      setTeamsOpen(defaultTeamsOpen);
      setLnbTooltip(null);
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
  }, [defaultTeamsOpen, pathname]);

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

  const toggleNavigation = () => {
    setMobileMenuOpen((value) => !value);
  };

  const showLnbTooltip = (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>, label: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setLnbTooltip({
      label,
      top: Math.min(Math.max(rect.top + rect.height / 2, 24), window.innerHeight - 24),
    });
  };

  const toggleDarkMode = () => {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  if (pathname === "/lab/chzzk-concept") return <>{children}</>;

  return (
    <div
      className="text-[#141517]"
      data-app-shell
      style={{ "--shell-mobile-header-offset": primaryHeaderVisible ? "56px" : "0px" } as React.CSSProperties}
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
      <header className={`fixed inset-x-0 top-0 z-50 flex items-center border-b border-[#e8e8eb] bg-[var(--page-background)] px-3 transition-transform duration-200 sm:px-4 md:h-16 md:translate-y-0 dark:border-[var(--ui-border)] ${communityPostDetail ? "h-12" : "h-14 sm:h-16"} ${communityPostDetail || primaryHeaderVisible ? "translate-y-0" : "-translate-y-full"}`}>
        {communityPostDetail ? (
          <div className="relative flex w-full items-center justify-center md:hidden">
            <Link
              href={communityPostBackHref}
              onClick={(event) => {
                if (window.history.length > 1) {
                  event.preventDefault();
                  router.back();
                }
              }}
              className="absolute left-0 grid h-11 w-11 place-items-center rounded-xl hover:bg-[var(--ui-card-hover)]"
              aria-label="게시글 닫기"
            >
              <X size={22} strokeWidth={1.8} />
            </Link>
            <p className="font-paperozi max-w-[70vw] truncate text-center text-[16px] font-bold text-[var(--ui-ink)]">{communityPostTitle}</p>
          </div>
        ) : null}
        <div className={communityPostDetail ? "hidden md:contents" : "contents"}>
        {fanRoute ? (
          <div className="relative flex min-w-0 flex-1 items-center md:hidden">
            <Link href="/" className="flex h-11 shrink-0 items-center" aria-label="MINION 메인으로 이동">
              <BrandLogo accentColor={currentFanTeam?.primaryColor} className="w-16" priority />
            </Link>
            <button type="button" onClick={() => setTeamSwitcherOpen((value) => !value)} className="flex min-w-0 items-center gap-1 rounded-xl px-2 py-2 text-[14px] font-black" aria-expanded={teamSwitcherOpen} aria-haspopup="menu">
              <span className="truncate">{currentFanTeam?.shortName ?? fanKey?.toUpperCase()}</span><ChevronDown size={16} className={`shrink-0 transition ${teamSwitcherOpen ? "rotate-180" : ""}`} />
            </button>
            {teamSwitcherOpen ? (
              <div role="menu" className="absolute left-0 top-[48px] z-50 w-56 overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-xl">
                {shellTeams.map((team) => <Link key={team.id} role="menuitem" href={`/fan/${team.fanSiteHost}`} onClick={() => setTeamSwitcherOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold hover:bg-[var(--ui-card-hover)]"><TeamLogo team={team} size="h-7 w-7" themeAware /><span className="truncate">{team.shortName}</span></Link>)}
              </div>
            ) : null}
          </div>
        ) : null}
        <button type="button" onClick={toggleNavigation} className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-[var(--ui-card-hover)] md:max-[1199px]:grid" aria-label={mobileMenuOpen ? "내비게이션 닫기" : "내비게이션 열기"} aria-expanded={mobileMenuOpen}>
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href="/" className={`ml-1.5 shrink-0 text-[22px] font-black tracking-[-0.06em] text-[#18191c] sm:ml-2 sm:text-[25px] dark:text-white ${fanRoute ? "hidden md:block" : "block"}`}>
          <BrandLogo accentColor={currentFanTeam?.primaryColor} className="w-16 sm:w-24" priority />
        </Link>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden items-center justify-center min-[1200px]:flex"
          style={{ left: focusRoute ? 0 : 56 }}
        >
          <HeaderSearch className="pointer-events-auto w-[480px]" />
        </div>
        <button type="button" onClick={() => setNotificationPanelOpen(true)} className="relative ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#62666d] transition hover:bg-[var(--ui-card-hover)] dark:text-[#a7acb5]" aria-label={`알림${unreadNotificationCount > 0 ? `, 읽지 않은 알림 ${unreadNotificationCount}개` : ""}`} aria-haspopup="dialog">
          <Bell size={20} />
          {unreadNotificationCount > 0 ? <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-0.5 text-[12px] font-medium leading-none text-white" aria-hidden>{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span> : null}
        </button>
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
        <button type="button" onClick={toggleDarkMode} className="mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#62666d] transition hover:bg-[var(--ui-card-hover)] sm:mr-2 dark:bg-[rgba(0,0,0,0)] dark:text-[#a7acb5]" aria-label="색상 모드 전환" title="색상 모드 전환">
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
              <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                {pendingSupportInquiryCount > 9 ? "9+" : pendingSupportInquiryCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        {currentUser ? (
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Link href="/me" className="flex min-h-11 min-w-0 max-w-[126px] items-center gap-1.5 text-[13px] font-bold sm:max-w-none sm:gap-2 sm:text-sm">
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

      {mobileMenuOpen ? (
        <div className={`fixed inset-x-0 top-14 z-40 overflow-y-auto border-b border-[#e8e8eb] bg-[var(--page-background)] px-4 py-4 shadow-xl shadow-black/10 sm:top-16 min-[1200px]:hidden dark:border-[var(--ui-border)] ${compactHubShell ? "bottom-[52px] md:bottom-0" : "bottom-0"}`}>
          {currentUser ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--ui-card-bg)] px-4 py-3">
              <RankAvatar
                tier={currentUser.tier}
                src={currentUser.profileImageUrl}
                fallback={currentUser.nickname ?? "MY"}
                size="md"
              />
              <Link href="/me" onClick={() => setMobileMenuOpen(false)} className="min-w-0 text-sm font-black"><span className="block truncate">{currentUser.nickname ?? "프로필"}</span><span className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-[var(--ui-muted)]"><Coins size={13} />{currentUser.lp.toLocaleString("ko-KR")} LP</span></Link>
              <LogoutButton className="shrink-0 rounded-xl border border-[#d9dce1] bg-white px-3 py-2 text-[13px] font-black text-[#18191c] shadow-sm dark:border-[var(--ui-border)] dark:bg-[#30343b] dark:text-white" />
            </div>
          ) : null}
          <nav className="grid grid-cols-2 gap-2" aria-label="전체 메뉴">
            {desktopNav.map(({ href, label, icon: Icon, prefetch }) => {
              const active = isActiveRoute(pathname, href);
              return <Link key={href} href={href} prefetch={prefetch} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-[var(--ui-card-bg)] text-[#18191c] dark:text-white" : "hover:bg-[var(--ui-card-hover)]"}`}><Icon size={18} /><span className="min-w-0 truncate">{label}</span></Link>;
            })}
          </nav>
          {followedTeams.length > 0 ? (
            <section className="mt-5 border-t border-[#ededf0] pt-4 dark:border-[var(--ui-border)]" aria-label="내 팀">
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Heart size={18} /><span>내 팀</span></div>
              <div className="grid grid-cols-2 gap-2">
                {followedTeams.map((team) => {
                  const active = fanKey === team.fanSiteHost;
                  return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} onClick={() => setMobileMenuOpen(false)} title={team.name} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[var(--ui-card-bg)]" : "hover:bg-[var(--ui-card-hover)]"}`}><TeamLogo team={team} size="h-8 w-8" themeAware imageClassName="h-7 w-7 object-contain" /><span className="min-w-0 truncate">{team.shortName}</span></Link>;
                })}
              </div>
            </section>
          ) : null}
          <section className="mt-5 border-t border-[#ededf0] pt-4 dark:border-[var(--ui-border)]" aria-label="팀 채널">
            <div className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Shield size={18} /><span>팀 채널</span></div>
            <div className="grid grid-cols-2 gap-2">
              {channelTeams.map((team) => {
                const active = fanKey === team.fanSiteHost;
                return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} onClick={() => setMobileMenuOpen(false)} title={team.name} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[var(--ui-card-bg)]" : "hover:bg-[var(--ui-card-hover)]"}`}><TeamLogo team={team} size="h-8 w-8" themeAware imageClassName="h-7 w-7 object-contain" /><span className="min-w-0 truncate">{team.shortName}</span></Link>;
              })}
            </div>
          </section>
        </div>
      ) : null}

      {!focusRoute ? <aside className="app-lnb fixed bottom-0 left-0 top-16 z-40 hidden w-14 border-r border-[#ececef] bg-[var(--page-background)] min-[1200px]:block dark:border-[var(--ui-border)]">
        <div className="app-lnb-scrollbar flex h-full flex-col items-center overflow-y-auto px-1.5 py-2">
          <nav className="space-y-1" aria-label="데스크톱 주요 메뉴">
            {desktopNav.map(({ href, label, icon: Icon, prefetch }) => {
              const active = isActiveRoute(pathname, href);
              return <Link key={href} href={href} prefetch={prefetch} aria-label={label} aria-current={active ? "page" : undefined} data-active={active ? "true" : undefined} onMouseEnter={(event) => showLnbTooltip(event, label)} onMouseLeave={() => setLnbTooltip(null)} onFocus={(event) => showLnbTooltip(event, label)} onBlur={() => setLnbTooltip(null)} className={`grid h-11 w-11 place-items-center rounded-xl transition ${active ? "bg-[var(--ui-card-bg)] text-[var(--ui-ink)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"}`}><Icon size={20} /><span className="sr-only">{label}</span></Link>;
            })}
          </nav>
          <div className="my-3 w-8 border-t border-[#ededf0] dark:border-[var(--ui-border)]" />
          {followedTeams.length > 0 ? (
            <div className="flex flex-col items-center gap-1" aria-label="내 팀">
              <div className="grid h-9 w-11 place-items-center text-[var(--ui-muted)]" aria-label="내가 팔로우한 팀" onMouseEnter={(event) => showLnbTooltip(event, "내가 팔로우한 팀")} onMouseLeave={() => setLnbTooltip(null)}>
                <Heart size={20} />
                <span className="sr-only">내 팀</span>
              </div>
              {followedTeams.map((team) => {
                const active = fanKey === team.fanSiteHost;
                const tooltip = `${team.name} · 내가 팔로우한 팀`;
                return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} aria-label={`${team.name} 팀 채널`} aria-current={active ? "page" : undefined} onMouseEnter={(event) => showLnbTooltip(event, tooltip)} onMouseLeave={() => setLnbTooltip(null)} onFocus={(event) => showLnbTooltip(event, tooltip)} onBlur={() => setLnbTooltip(null)} className={`grid h-11 w-11 place-items-center rounded-xl transition ${active ? "bg-[var(--ui-card-bg)]" : "hover:bg-[var(--ui-card-hover)]"}`}><TeamLogo team={team} size="h-8 w-8" themeAware imageClassName="h-7 w-7 object-contain" /></Link>;
              })}
              <div className="my-2 w-8 border-t border-[#ededf0] dark:border-[var(--ui-border)]" />
            </div>
          ) : null}
          <button type="button" onClick={() => setTeamsOpen((value) => !value)} onMouseEnter={(event) => showLnbTooltip(event, teamsOpen ? "팀 채널 접기" : "팀 채널 펼치기")} onMouseLeave={() => setLnbTooltip(null)} onFocus={(event) => showLnbTooltip(event, teamsOpen ? "팀 채널 접기" : "팀 채널 펼치기")} onBlur={() => setLnbTooltip(null)} className={`flex h-12 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl transition ${teamsOpen ? "bg-[var(--ui-card-bg)] text-[var(--ui-ink)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"}`} aria-label={teamsOpen ? "전체 팀 채널 접기" : "전체 팀 채널 펼치기"} aria-haspopup="menu" aria-expanded={teamsOpen}>
            <Shield size={20} />
            <ChevronDown size={13} strokeWidth={2.5} className={`transition-transform ${teamsOpen ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {teamsOpen ? (
            <div role="menu" aria-label="전체 팀 채널" className="mt-1 flex flex-col items-center gap-1">
              {channelTeams.map((team) => {
                const active = fanKey === team.fanSiteHost;
                return <Link key={team.id} role="menuitem" href={`/fan/${team.fanSiteHost}`} onClick={() => setTeamsOpen(false)} aria-label={`${team.name} 팀 채널`} aria-current={active ? "page" : undefined} onMouseEnter={(event) => showLnbTooltip(event, team.name)} onMouseLeave={() => setLnbTooltip(null)} onFocus={(event) => showLnbTooltip(event, team.name)} onBlur={() => setLnbTooltip(null)} className={`grid h-11 w-11 place-items-center rounded-xl transition ${active ? "bg-[var(--ui-card-bg)]" : "hover:bg-[var(--ui-card-hover)]"}`}><TeamLogo team={team} size="h-8 w-8" themeAware imageClassName="h-7 w-7 object-contain" /></Link>;
              })}
            </div>
          ) : null}
        </div>
        {lnbTooltip ? (
          <div role="tooltip" className="pointer-events-none fixed left-16 z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--ui-ink)] shadow-lg dark:bg-[var(--ui-surface-muted)]" style={{ top: lnbTooltip.top }}>
            {lnbTooltip.label}
          </div>
        ) : null}
      </aside> : null}

      {compactHubShell ? (
        <aside className={`fixed bottom-0 left-0 top-16 z-40 hidden w-16 flex-col items-center border-r border-[#ececef] bg-[var(--page-background)] py-3 dark:border-[var(--ui-border)] ${mobileMenuOpen ? "" : "md:max-[1199px]:flex"}`} aria-label="태블릿 주요 메뉴">
          {compactNav.map(({ href, label, icon: Icon }) => {
            const active = isGlobalNavActive(pathname, href);
            const destination = href === "/fan" ? (favoriteTeam ? `/fan/${favoriteTeam.fanSiteHost}` : "/teams") : href;
            return <Link key={href} href={destination} aria-current={active ? "page" : undefined} title={label} className={`relative mb-1 grid h-12 w-12 place-items-center rounded-xl transition ${active ? "bg-[var(--ui-card-bg)] text-[#18191c] dark:text-white" : "text-[#777b82] hover:bg-[var(--ui-card-hover)]"}`}><span className="relative">{href === "/fan" && favoriteTeam ? <TeamLogo team={favoriteTeam} size="h-7 w-7" themeAware /> : <Icon size={21} />}</span><span className="sr-only">{label}</span></Link>;
          })}
        </aside>
      ) : null}

      <div className={`flex flex-col md:pt-16 ${focusRoute || communityPostDetail ? "pt-12" : "pt-14 sm:pt-16"} ${compactHubShell ? "md:max-[1199px]:pl-16" : ""} ${focusRoute ? "" : "min-[1200px]:pl-14"}`}>
        <div className={`${!focusRoute && !communityPostDetail ? "compact-hub-content pb-0" : "pb-0"}`} data-shell-content={!focusRoute && !communityPostDetail ? "compact-hub" : undefined}>
          {showHubLocalNavigation ? (
            <nav aria-label="허브 로컬 메뉴" className="hub-local-navigation sticky z-30 border-b border-[var(--ui-border)] bg-[var(--page-background)] transition-[top] duration-200 md:hidden">
              <div className="flex h-12 w-full items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {hubLocalNav.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  return <Link key={item.href} href={item.href} prefetch={item.prefetch} aria-current={active ? "page" : undefined} className={`font-paperozi flex min-w-[64px] flex-1 items-center justify-center whitespace-nowrap border-b-[3px] pt-0.5 text-[14px] font-bold transition-colors ${active ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>{item.label}</Link>;
                })}
              </div>
            </nav>
          ) : null}
          {children}
        </div>
        {focusRoute ? (
          <div className="hidden md:block"><SiteFooter accentColor={currentFanTeam?.primaryColor} /></div>
        ) : (
          <SiteFooter accentColor={currentFanTeam?.primaryColor} />
        )}
      </div>

      {!focusRoute && !communityPostDetail ? (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(52px+env(safe-area-inset-bottom))] items-start border-t border-[#e8e8eb] bg-[var(--page-background)] pt-1 backdrop-blur md:hidden dark:border-[var(--ui-border)]" aria-label="모바일 주요 메뉴">
          {compactNav.map(({ href, label, icon: Icon }) => {
            const active = isGlobalNavActive(pathname, href);
            const fanItem = href === "/fan";
            const destination = fanItem ? (favoriteTeam ? `/fan/${favoriteTeam.fanSiteHost}` : "/teams") : href;
            const itemClassName = `font-paperozi relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[11px] font-medium ${active ? "text-[var(--ui-ink)]" : "text-[#777b82]"}`;
            if (fanItem && !favoriteTeam) {
              return <FanTeamPicker key={href} teams={shellTeams} followedTeams={followedTeams} currentTeam={currentFanTeam} active={active} className={itemClassName} />;
            }
            return <Link key={href} href={destination} aria-current={active ? "page" : undefined} className={itemClassName}><span className={`relative grid place-items-center ${fanItem && favoriteTeam ? "-mt-5 h-10 w-10 overflow-hidden rounded-full border-[3px] border-[var(--page-background)] bg-[var(--ui-surface-muted)]" : "h-5 w-5"}`}>{fanItem && favoriteTeam ? <TeamLogo team={favoriteTeam} size="h-7 w-7" plain themeAware /> : <Icon size={20} strokeWidth={active ? 2.5 : 2} />}</span><span className="max-w-full truncate">{label}</span></Link>;
          })}
        </nav>
      ) : null}

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
