"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Coins, Menu, Moon, Newspaper, Search, Shield, Sparkles, Sun, Swords, Users, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SiteFooter } from "@/components/layout/site-footer";
import { RankBadge } from "@/components/rank/rank-badge";
import { teams } from "@/lib/team-themes";
import type { Tier } from "@/lib/rank/config";

export type AppShellUser = { nickname: string | null; tier: Tier; lp: number } | null;

const nav = [
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/tournaments", label: "대회", icon: Swords },
  { href: "/predictions", label: "승부예측", icon: Sparkles },
  { href: "/records", label: "기록실", icon: BarChart3 },
  { href: "/players", label: "선수", icon: UserRound },
  { href: "/reports", label: "위클리 리포트", icon: Newspaper },
  { href: "/community", label: "커뮤니티", icon: Users },
];

export function AppShell({ children, currentUser = null }: { children: React.ReactNode; currentUser?: AppShellUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const fanKey = pathname.startsWith("/fan/") ? pathname.split("/")[2] : null;
  useEffect(() => {
    document.documentElement.style.setProperty("--shell-lnb-width", collapsed ? "72px" : "216px");
  }, [collapsed]);
  const toggleDarkMode = () => {
    const nextDarkMode = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDarkMode);
    localStorage.setItem("minion-theme", nextDarkMode ? "dark" : "light");
  };
  if (pathname === "/lab/chzzk-concept") return <>{children}</>;

  return (
    <div className="min-h-screen text-[#141517]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center border-b border-[#e8e8eb] bg-background px-4">
        <button type="button" onClick={() => setCollapsed((v) => !v)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-[#f4f4f5]" aria-label="사이드바 접기"><Menu size={22} /></button>
        <Link href="/" className="ml-2 text-[25px] font-black tracking-[-0.06em] text-[#18191c]">MINION<span className="text-[#8b8e94]">.</span></Link>
        <label className="mx-auto hidden h-10 w-[360px] items-center gap-2 rounded-lg bg-[#f2f3f5] px-4 text-[#777b82] md:flex">
          <Search size={18} /><input aria-label="팀, 선수, 대회 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="팀, 선수, 대회 검색" />
        </label>
        <button type="button" onClick={toggleDarkMode} className="mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#62666d] transition hover:bg-[#f4f4f5] dark:text-[#a7acb5] dark:hover:bg-[#282c31]" aria-label="색상 모드 전환" title="색상 모드 전환">
          <Moon size={20} className="dark:hidden" />
          <Sun size={20} className="hidden dark:block" />
        </button>
        {currentUser ? <div className="flex items-center gap-2"><Link href="/me" className="flex items-center gap-2 text-sm font-bold"><span className="hidden items-center gap-1 text-xs font-black text-[var(--ui-muted)] sm:flex"><Coins size={14} />{currentUser.lp.toLocaleString("ko-KR")} LP</span>{currentUser.nickname ?? "프로필"}<RankBadge tier={currentUser.tier} /></Link><LogoutButton /></div> : <Link href="/login" className="rounded-lg bg-[#141517] px-4 py-2 text-sm font-bold text-white">로그인</Link>}
      </header>

      <aside className={`app-lnb fixed bottom-0 left-0 top-16 z-40 hidden border-r border-[#ececef] bg-background transition-[width] lg:block ${collapsed ? "w-[72px]" : "w-[216px]"}`}>
        <div className="flex h-full flex-col overflow-y-auto p-3">
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return <Link key={href} href={href} data-active={active} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-bold transition ${active ? "bg-[#eeeeef] text-[#18191c]" : "hover:bg-[#f4f4f5]"}`}><Icon size={20} /><span className={collapsed ? "hidden" : ""}>{label}</span></Link>;
            })}
          </nav>
          <div className="my-4 border-t border-[#ededf0]" />
          <button type="button" onClick={() => setTeamsOpen((v) => !v)} className={`flex items-center gap-3 px-3 py-2 text-sm font-extrabold ${collapsed ? "justify-center" : ""}`}><Shield size={20} />{!collapsed && <><span>팀 채널</span><ChevronDown size={16} className={`ml-auto transition ${teamsOpen ? "rotate-180" : ""}`} /></>}</button>
          {teamsOpen && <div className="mt-1 space-y-1">{teams.map((team) => {
            const active = fanKey === team.fanSiteHost;
            return <Link key={team.id} href={`/fan/${team.fanSiteHost}`} title={team.name} data-active={active} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[#f0f1f2]" : "hover:bg-[#f6f6f7]"}`}>
              <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f1f2f4]">
                {team.logoUrl ? team.logoWhiteUrl ? <>
                  <img src={team.logoUrl} alt="" className="h-6 w-6 object-contain dark:hidden" />
                  <img src={team.logoWhiteUrl} alt="" aria-hidden="true" className="hidden h-6 w-6 object-contain dark:block" />
                </> : <img src={team.logoUrl} alt="" className="h-6 w-6 object-contain" /> : team.shortName.slice(0,1)}
              </span>
              {!collapsed && <><span className="truncate">{team.shortName}</span>{active && <span className="ml-auto h-2 w-2 rounded-full bg-[#18191c]" />}</>}
            </Link>;
          })}</div>}
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="mt-auto flex h-10 items-center justify-center rounded-xl text-[#777b82] hover:bg-[#f4f4f5]">{collapsed ? <ChevronRight size={20} /> : <><ChevronLeft size={20} /><span className="ml-2 text-xs font-bold">사이드바 접기</span></>}</button>
        </div>
      </aside>

      <div className={`flex min-h-screen flex-col pt-16 transition-[padding] ${collapsed ? "lg:pl-[72px]" : "lg:pl-[216px]"}`}><div className="flex-1 bg-[var(--ui-surface)]">{children}</div><SiteFooter /></div>
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-[#e8e8eb] bg-background lg:hidden">{nav.slice(0,5).map(({href,label,icon:Icon}) => <Link key={href} href={href} className={`flex flex-col items-center gap-1 text-[11px] font-bold ${pathname.startsWith(href) ? "text-[#18191c]" : "text-[#6f737a]"}`}><Icon size={20}/>{label}</Link>)}</nav>
    </div>
  );
}
