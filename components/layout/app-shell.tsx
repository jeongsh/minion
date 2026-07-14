"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  Search,
  Shield,
  Sparkles,
  Sun,
  Swords,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { RankBadge } from "@/components/rank/rank-badge";
import { TeamLogo } from "@/components/ui/team-logo";
import { teams } from "@/lib/team-themes";
import type { Tier } from "@/lib/rank/config";

export type AppShellUser = { nickname: string | null; tier: Tier; lp: number } | null;

const desktopNav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/tournaments", label: "대회", icon: Swords },
  { href: "/predictions", label: "승부예측", icon: Sparkles },
  { href: "/players", label: "선수", icon: UserRound },
  { href: "/reports", label: "데이터 리포트", icon: Newspaper },
  { href: "/community", label: "커뮤니티", icon: Users },
];

const compactNav = [
  { href: "/", label: "홈", icon: Home },
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/predictions", label: "예측", icon: Sparkles },
  { href: "/community", label: "커뮤니티", icon: MessageCircle },
  { href: "/me", label: "MY", icon: UserRound },
];

function isActiveRoute(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function focusRouteMeta(pathname: string) {
  if (pathname === "/login") return { title: "로그인", backHref: "/" };
  if (pathname === "/signup") return { title: "회원가입", backHref: "/login" };
  if (pathname === "/me/profile") return { title: "프로필 관리", backHref: "/me" };
  if (pathname.endsWith("/snapshot")) return { title: "세트 스냅샷", backHref: pathname.replace(/\/snapshot$/, "") };
  if (/^\/community\/(new|[^/]+\/new|post\/[^/]+\/edit)$/.test(pathname)) return { title: pathname.endsWith("/edit") ? "글 수정" : "글쓰기", backHref: "/community" };
  const fanWrite = pathname.match(/^\/fan\/([^/]+)\/community\/(new|[^/]+\/new|post\/[^/]+\/edit)$/);
  if (fanWrite) return { title: pathname.endsWith("/edit") ? "글 수정" : "글쓰기", backHref: `/fan/${fanWrite[1]}/community` };
  return null;
}

export function AppShell({
  children,
  currentUser = null,
  followedTeamIds = [],
}: {
  children: React.ReactNode;
  currentUser?: AppShellUser;
  followedTeamIds?: string[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const fanKey = pathname.startsWith("/fan/") ? pathname.split("/")[2] : null;
  const fanRoute = pathname.startsWith("/fan/");
  const focus = focusRouteMeta(pathname);
  const focusRoute = Boolean(focus);
  const compactHubShell = !fanRoute && !focusRoute;
  const followedTeamIdSet = new Set(followedTeamIds);
  const followedTeams = teams.filter((team) => followedTeamIdSet.has(team.id) || followedTeamIdSet.has(team.fanSiteHost));
  const channelTeams = teams.filter((team) => !followedTeamIdSet.has(team.id) && !followedTeamIdSet.has(team.fanSiteHost));

  useEffect(() => {
    document.documentElement.style.setProperty("--shell-lnb-width", collapsed ? "72px" : "216px");
  }, [collapsed]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1200px)");
    const closeMobileMenu = () => {
      if (desktopQuery.matches) setMobileMenuOpen(false);
    };
    closeMobileMenu();
    desktopQuery.addEventListener("change", closeMobileMenu);
    return () => desktopQuery.removeEventListener("change", closeMobileMenu);
  }, []);

  const toggleNavigation = () => {
    if (window.matchMedia("(min-width: 1200px)").matches) {
      setCollapsed((value) => !value);
      return;
    }
    setMobileMenuOpen((value) => !value);
  };

  const toggleDarkMode = () => {
    const nextDarkMode = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDarkMode);
    localStorage.setItem("minion-theme", nextDarkMode ? "dark" : "light");
  };

  if (pathname === "/lab/chzzk-concept") return <>{children}</>;

  return (
    <div className="min-h-screen text-[#141517]">
      {focus ? (
        <header className="fixed inset-x-0 top-0 z-50 grid h-14 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-[#e8e8eb] bg-background px-2 sm:h-16 dark:border-[#343840]">
          <Link href={focus.backHref} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[#f4f4f5] dark:hover:bg-[#282c31]" aria-label="이전 화면"><ChevronLeft size={22} /></Link>
          <p className="truncate text-center text-[16px] font-black text-[var(--ui-ink)]">{focus.title}</p>
          <span aria-hidden="true" />
        </header>
      ) : (
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-[#e8e8eb] bg-background px-3 sm:h-16 sm:px-4 dark:border-[#343840]">
        <button type="button" onClick={toggleNavigation} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-[#f4f4f5] dark:hover:bg-[#282c31]" aria-label={mobileMenuOpen ? "내비게이션 닫기" : "내비게이션 열기"} aria-expanded={mobileMenuOpen}>
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link href="/" className="ml-1.5 shrink-0 text-[22px] font-black tracking-[-0.06em] text-[#18191c] sm:ml-2 sm:text-[25px] dark:text-white">
          MINION<span className="text-[#8b8e94]">.</span>
        </Link>
        <label className="mx-auto hidden h-10 w-[360px] items-center gap-2 rounded-xl bg-[#f2f3f5] px-4 text-[#777b82] min-[1200px]:flex dark:bg-[#282c31]">
          <Search size={18} />
          <input aria-label="팀, 선수, 대회 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="팀, 선수, 대회 검색" />
        </label>
        <button type="button" onClick={toggleDarkMode} className="ml-auto mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#62666d] transition hover:bg-[#f4f4f5] sm:mr-2 dark:text-[#a7acb5] dark:hover:bg-[#282c31]" aria-label="색상 모드 전환" title="색상 모드 전환">
          <Moon size={20} className="dark:hidden" />
          <Sun size={20} className="hidden dark:block" />
        </button>
        {currentUser ? (
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Link href="/me" className="flex min-h-11 min-w-0 max-w-[126px] items-center gap-1.5 text-[13px] font-bold sm:max-w-none sm:gap-2 sm:text-sm">
              <span className="hidden items-center gap-1 text-[13px] font-black text-[var(--ui-muted)] min-[1200px]:flex"><Coins size={14} />{currentUser.lp.toLocaleString("ko-KR")} LP</span>
              <span className="hidden min-w-0 truncate sm:block">{currentUser.nickname ?? "프로필"}</span>
              <RankBadge tier={currentUser.tier} />
            </Link>
            <div className="hidden min-[1200px]:block"><LogoutButton /></div>
          </div>
        ) : (
          <Link href="/login" className="flex min-h-11 items-center rounded-xl bg-[#141517] px-3 py-2 text-[13px] font-bold text-white sm:px-4 sm:text-sm">로그인</Link>
        )}
      </header>
      )}

      {mobileMenuOpen ? (
        <div className={`fixed inset-x-0 top-14 z-40 overflow-y-auto border-b border-[#e8e8eb] bg-background px-4 py-4 shadow-xl shadow-black/10 sm:top-16 min-[1200px]:hidden dark:border-[#343840] ${compactHubShell ? "bottom-16 md:bottom-0" : "bottom-0"}`}>
          {currentUser ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#f4f4f5] px-4 py-3 dark:bg-[#282c31]">
              <Link href="/me" onClick={() => setMobileMenuOpen(false)} className="min-w-0 text-sm font-black"><span className="block truncate">{currentUser.nickname ?? "프로필"}</span><span className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-[var(--ui-muted)]"><Coins size={13} />{currentUser.lp.toLocaleString("ko-KR")} LP</span></Link>
              <LogoutButton className="shrink-0 rounded-xl border border-[#d9dce1] bg-white px-3 py-2 text-[13px] font-black text-[#18191c] shadow-sm dark:border-[#434854] dark:bg-[#30343b] dark:text-white" />
            </div>
          ) : null}
          <nav className="grid grid-cols-2 gap-2" aria-label="전체 메뉴">
            {desktopNav.map(({ href, label, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);
              return <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-[#eeeeef] text-[#18191c] dark:bg-[#30343b] dark:text-white" : "hover:bg-[#f4f4f5] dark:hover:bg-[#282c31]"}`}><Icon size={18} /><span className="min-w-0 truncate">{label}</span></Link>;
            })}
          </nav>
          {followedTeams.length > 0 ? (
            <section className="mt-5 border-t border-[#ededf0] pt-4 dark:border-[#343840]" aria-label="내 팀">
              <div className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Heart size={18} /><span>내 팀</span></div>
              <div className="grid grid-cols-2 gap-2">
                {followedTeams.map((team) => {
                  const active = fanKey === team.fanSiteHost;
                  return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} onClick={() => setMobileMenuOpen(false)} title={team.name} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#f0f1f2] dark:bg-[#30343b]" : "hover:bg-[#f6f6f7] dark:hover:bg-[#282c31]"}`}><TeamLogo team={team} size="h-8 w-8" themeAware imageClassName="h-7 w-7 object-contain" /><span className="min-w-0 truncate">{team.shortName}</span></Link>;
                })}
              </div>
            </section>
          ) : null}
          <section className="mt-5 border-t border-[#ededf0] pt-4 dark:border-[#343840]" aria-label="팀 채널">
            <div className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Shield size={18} /><span>팀 채널</span></div>
            <div className="grid grid-cols-2 gap-2">
              {channelTeams.map((team) => {
                const active = fanKey === team.fanSiteHost;
                return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} onClick={() => setMobileMenuOpen(false)} title={team.name} aria-current={active ? "page" : undefined} className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#f0f1f2] dark:bg-[#30343b]" : "hover:bg-[#f6f6f7] dark:hover:bg-[#282c31]"}`}><TeamLogo team={team} size="h-8 w-8" themeAware imageClassName="h-7 w-7 object-contain" /><span className="min-w-0 truncate">{team.shortName}</span></Link>;
              })}
            </div>
          </section>
        </div>
      ) : null}

      {!focusRoute ? <aside className={`app-lnb fixed bottom-0 left-0 top-16 z-40 hidden border-r border-[#ececef] bg-background transition-[width] min-[1200px]:block dark:border-[#343840] ${collapsed ? "w-[72px]" : "w-[216px]"}`}>
        <div className="flex h-full flex-col overflow-y-auto p-3">
          <nav className="space-y-1" aria-label="데스크톱 주요 메뉴">
            {desktopNav.map(({ href, label, icon: Icon }) => {
              const active = isActiveRoute(pathname, href);
              return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-bold transition ${active ? "bg-[#eeeeef] dark:bg-[#30343b]" : "hover:bg-[#f4f4f5] dark:hover:bg-[#282c31]"}`}><Icon size={20} /><span className={collapsed ? "hidden" : ""}>{label}</span></Link>;
            })}
          </nav>
          <div className="my-4 border-t border-[#ededf0] dark:border-[#343840]" />
          {followedTeams.length > 0 ? (
            <div className="space-y-1">
              <div className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-extrabold ${collapsed ? "justify-center" : ""}`}>
                <Heart size={20} />
                {!collapsed && <span>내 팀</span>}
              </div>
              {followedTeams.map((team) => {
                const active = fanKey === team.fanSiteHost;
                return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} title={team.name} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#f0f1f2] dark:bg-[#30343b]" : "hover:bg-[#f6f6f7] dark:hover:bg-[#282c31]"}`}><TeamLogo team={team} size="h-7 w-7" themeAware imageClassName="h-6 w-6 object-contain" />{!collapsed && <><span className="truncate">{team.shortName}</span>{active && <span className="ml-auto h-2 w-2 rounded-full bg-[#18191c] dark:bg-white" />}</>}</Link>;
              })}
              <div className="my-3 border-t border-[#ededf0] dark:border-[#343840]" />
            </div>
          ) : null}
          <button type="button" onClick={() => setTeamsOpen((value) => !value)} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-extrabold ${collapsed ? "justify-center" : ""}`}><Shield size={20} />{!collapsed && <><span>팀 채널</span><ChevronDown size={16} className={`ml-auto transition ${teamsOpen ? "rotate-180" : ""}`} /></>}</button>
          {teamsOpen ? <div className="mt-1 space-y-1">{channelTeams.map((team) => {
            const active = fanKey === team.fanSiteHost;
            return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} title={team.name} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#f0f1f2] dark:bg-[#30343b]" : "hover:bg-[#f6f6f7] dark:hover:bg-[#282c31]"}`}><TeamLogo team={team} size="h-7 w-7" themeAware imageClassName="h-6 w-6 object-contain" />{!collapsed && <><span className="truncate">{team.shortName}</span>{active && <span className="ml-auto h-2 w-2 rounded-full bg-[#18191c] dark:bg-white" />}</>}</Link>;
          })}</div> : null}
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="mt-auto flex h-11 items-center justify-center rounded-xl text-[#777b82] hover:bg-[#f4f4f5] dark:hover:bg-[#282c31]">{collapsed ? <ChevronRight size={20} /> : <><ChevronLeft size={20} /><span className="ml-2 text-[13px] font-bold">사이드바 접기</span></>}</button>
        </div>
      </aside> : null}

      {compactHubShell ? (
        <aside className={`fixed bottom-0 left-0 top-16 z-40 hidden w-16 flex-col items-center border-r border-[#ececef] bg-background py-3 dark:border-[#343840] ${mobileMenuOpen ? "" : "md:max-[1199px]:flex"}`} aria-label="태블릿 주요 메뉴">
          {compactNav.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} title={label} className={`mb-1 grid h-12 w-12 place-items-center rounded-xl transition ${active ? "bg-[#eeeeef] text-[#18191c] dark:bg-[#30343b] dark:text-white" : "text-[#777b82] hover:bg-[#f4f4f5] dark:hover:bg-[#282c31]"}`}><Icon size={21} /><span className="sr-only">{label}</span></Link>;
          })}
        </aside>
      ) : null}

      <div className={`flex min-h-screen flex-col pt-14 transition-[padding] sm:pt-16 ${compactHubShell ? "md:pl-16" : ""} ${focusRoute ? "" : collapsed ? "min-[1200px]:pl-[72px]" : "min-[1200px]:pl-[216px]"}`}>
        <div className={`flex-1 bg-[var(--ui-surface)] ${compactHubShell ? "compact-hub-content pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" : "pb-0"}`} data-shell-content={compactHubShell ? "compact-hub" : undefined}>{children}</div>
        {!focusRoute ? <SiteFooter /> : null}
      </div>

      {compactHubShell ? (
        <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start border-t border-[#e8e8eb] bg-background/95 pt-1 backdrop-blur md:hidden dark:border-[#343840]" aria-label="모바일 주요 메뉴">
          {compactNav.map(({ href, label, icon: Icon }) => {
            const active = isActiveRoute(pathname, href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-[11px] font-bold ${active ? "text-[#18191c] dark:text-white" : "text-[#777b82]"}`}><Icon size={20} strokeWidth={active ? 2.5 : 2} /><span className="max-w-full truncate">{label}</span></Link>;
          })}
        </nav>
      ) : null}
    </div>
  );
}
