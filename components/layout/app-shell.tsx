"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { RankBadge } from "@/components/rank/rank-badge";
import { LogoutButton } from "@/components/auth/logout-button";
import type { Tier } from "@/lib/rank/config";
import { getTeamByRouteKey } from "@/lib/team-themes";

export type AppShellUser = {
  nickname: string | null;
  tier: Tier;
} | null;

const headerNavItems = [
  { id: "home", href: "/", label: "홈" },
  { id: "schedule", href: "/schedule", label: "일정" },
  { id: "standings", href: "/standings", label: "순위" },
  { id: "teams", href: "/teams", label: "팀" },
  { id: "players", href: "/players", label: "선수" },
  { id: "community", href: "/community", label: "커뮤니티" },
];

function isHeaderNavActive(item: (typeof headerNavItems)[number], pathname: string) {
  if (item.id === "teams" && pathname.startsWith("/fan/")) return true;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
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

  return (
    <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-[#edf0f6] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-8 px-4 sm:px-6">
            <div className="flex min-w-0 shrink-0 items-center gap-2.5">
              <Link href="/" className="flex shrink-0 items-center" aria-label="MINION 홈">
                <span className="brand-logo-text text-3xl font-black tracking-normal text-[#071332]">MINION</span>
              </Link>
              {fanTeam ? (
                <>
                  <span className="text-lg font-light text-[#c7ccd6]" aria-hidden="true">/</span>
                  <Link
                    href={`/fan/${fanTeam.fanSiteHost}`}
                    className="flex min-w-0 items-center gap-2 rounded-full border border-[#e8eaf0] bg-[#f8f9fb] py-1 pl-1.5 pr-3 transition hover:border-[#cfd4df]"
                    aria-label={`${fanTeam.name} 팬페이지 홈`}
                  >
                    {fanTeam.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fanTeam.logoUrl} alt="" className="h-7 w-7 rounded-full bg-white object-contain p-1" />
                    ) : null}
                    <span className="truncate text-sm font-black text-[#111827]">{fanTeam.shortName}</span>
                  </Link>
                </>
              ) : null}
            </div>

            <nav aria-label="주요 메뉴" className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
              {headerNavItems.map((item) => {
                const isActive = isHeaderNavActive(item, pathname);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`relative whitespace-nowrap px-3 py-[27px] text-sm font-black transition-colors ${
                      isActive ? "text-[#172554]" : "text-[#111827] hover:text-[#4f46e5]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {item.label}
                    </span>
                    {isActive ? (
                      <span className="absolute bottom-3 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[#6158ff]" />
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

          {!isFanSite ? (
            <nav aria-label="모바일 메뉴" className="scrollbar-none flex gap-1 overflow-x-auto border-t border-[#f0f2f5] px-4 pb-2 pt-1.5 lg:hidden">
              {headerNavItems.map((item) => {
                const isActive = isHeaderNavActive(item, pathname);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                      isActive ? "bg-[#ebeaff] text-[#554cff]" : "text-[#667085] hover:bg-[#f4f5f8] hover:text-[#111827]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </header>
      {children}
      {showSiteFooter ? <SiteFooter /> : null}
    </div>
  );
}
