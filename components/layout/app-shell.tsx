"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { TeamSwitcher } from "@/components/layout/team-switcher";
import { RankBadge } from "@/components/rank/rank-badge";
import { LogoutButton } from "@/components/auth/logout-button";
import { fanNavItems, hubNavItems, type NavItem } from "@/lib/navigation";
import type { Tier } from "@/lib/rank/config";
import { getTeamByRouteKey } from "@/lib/team-themes";

export type AppShellUser = {
  nickname: string | null;
  tier: Tier;
} | null;

// GNB는 한 줄이고, 컨텍스트에 따라 내용이 바뀐다.
// 허브: LCK 전체 메뉴 / 팬페이지: 팀 스위처 + 해당 팀 메뉴 (허브 복귀는 로고)
function isNavActive(item: NavItem, pathname: string, contextHome: string) {
  if (item.href === pathname) return true;
  if (item.href === contextHome) return false;
  return pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  children,
  currentUser = null,
}: {
  children: React.ReactNode;
  currentUser?: AppShellUser;
}) {
  const pathname = usePathname();
  const isFanSite = pathname.startsWith("/fan/");
  const isAdmin = pathname.startsWith("/admin");
  const showSiteFooter = !isFanSite && !isAdmin;
  const fanRouteKey = isFanSite ? pathname.split("/")[2] : undefined;
  const fanTeam = fanRouteKey ? getTeamByRouteKey(fanRouteKey) : undefined;
  const contextHome = fanTeam ? `/fan/${fanTeam.fanSiteHost}` : "/";
  const navItems = fanTeam ? fanNavItems(fanTeam.fanSiteHost) : hubNavItems;
  // 헤더는 team-surface 래퍼(FanSiteLayout) 바깥에 있으므로 팀 테마 변수를 직접 주입한다.
  const headerStyle = fanTeam
    ? ({
        "--team-primary": fanTeam.primaryColor,
        "--team-secondary": fanTeam.secondaryColor,
      } as React.CSSProperties)
    : undefined;
  const activeTextClass = fanTeam ? "text-accent" : "text-[#172554]";
  const activeBarClass = fanTeam ? "bg-accent" : "bg-[#6158ff]";
  const hoverTextClass = fanTeam ? "hover:text-accent" : "hover:text-[#4f46e5]";
  const mobileActiveClass = fanTeam ? "bg-accent/10 text-accent" : "bg-[#ebeaff] text-[#554cff]";

  return (
    <div className="min-h-screen">
        <header
          className={`sticky top-0 z-40 border-b border-[#edf0f6] bg-white/95 backdrop-blur-xl ${fanTeam ? "team-surface" : ""}`}
          style={headerStyle}
        >
          <div className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-5 px-4 sm:px-6">
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <Link href="/" className="flex shrink-0 items-center" aria-label="MINION 홈">
                <span className="brand-logo-text text-[32px] font-black tracking-normal text-[#071332]">MINION</span>
              </Link>
              <TeamSwitcher team={fanTeam} pathname={pathname} />
            </div>

            <nav
              aria-label={fanTeam ? `${fanTeam.name} 팬페이지 메뉴` : "주요 메뉴"}
              className="hidden min-w-0 flex-1 items-center gap-2 lg:flex"
            >
              {navItems.map((item) => {
                const isActive = isNavActive(item, pathname, contextHome);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative whitespace-nowrap px-3 py-[27px] text-sm font-black transition-colors ${
                      isActive ? activeTextClass : `text-[#111827] ${hoverTextClass}`
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {item.label}
                    </span>
                    {isActive ? (
                      <span className={`absolute bottom-3 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full ${activeBarClass}`} />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-4">
              {/* <label className="hidden h-10 w-[240px] items-center gap-2 rounded-full border border-[#e1e6f0] bg-white px-4 text-sm text-[#7c86a0] md:flex">
                <span aria-hidden="true" className="text-[#59647c]">⌕</span>
                <span className="sr-only">검색</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[#9ca6bb]"
                  placeholder="팀, 선수, 뉴스 검색"
                />
              </label> */}
              {currentUser ? (
                <div className="hidden items-center gap-3 md:flex">
                  <Link
                    href="/me"
                    className="flex items-center gap-2 text-sm font-black text-[#111827]"
                  >
                    <span className="max-w-[120px] truncate">
                      {currentUser.nickname ?? "내 프로필"}
                    </span>
                    <RankBadge tier={currentUser.tier} />
                  </Link>
                  <LogoutButton />
                </div>
              ) : (
                <div className="hidden items-center gap-3 md:flex">
                  <Link
                    href="/login"
                    className="text-sm font-black text-[#111827]"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm font-black text-[#4f46e5]"
                  >
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>

          <nav aria-label="모바일 메뉴" className="scrollbar-none flex gap-1 overflow-x-auto border-t border-[#f0f2f5] px-4 pb-2 pt-1.5 lg:hidden">
            {navItems.map((item) => {
              const isActive = isNavActive(item, pathname, contextHome);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                    isActive ? mobileActiveClass : "text-[#667085] hover:bg-[#f4f5f8] hover:text-[#111827]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
      {children}
      {showSiteFooter ? <SiteFooter /> : null}
    </div>
  );
}
