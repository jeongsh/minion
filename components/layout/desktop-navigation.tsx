"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowLeftRight, CalendarDays, ChartNoAxesColumn, ChevronDown, Heart, MessagesSquare, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { matchMenuItems, recordMenuItems, type NavigationItem } from "@/components/layout/navigation-items";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Team } from "@/lib/types";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const rowClass = `flex h-9 md:max-[1199px]:h-11 w-full items-center gap-2 rounded-lg px-2 text-[14px] font-medium transition-colors hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] ${focusRing}`;
// 하위 항목: 아이콘 없이 상위 라벨 시작선(px-2 8 + 아이콘 18 + gap 8 = 34px)에 맞춘다.
const subRowClass = `flex h-8 md:max-[1199px]:h-10 w-full items-center gap-2 rounded-lg pl-[34px] pr-2 text-[14px] font-normal transition-colors hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] ${focusRing}`;
// 팀 항목: 로고가 아이콘 역할이라 상위 아이콘 열에 맞춘다.
const teamRowClass = `flex h-8 md:max-[1199px]:h-10 w-full items-center gap-2 rounded-lg px-2 text-[14px] font-normal transition-colors hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] ${focusRing}`;
const stateClass = (active: boolean) => active ? "bg-[var(--ui-card-bg)] text-[var(--ui-ink)]" : "text-[var(--ui-muted)]";

function MenuGroup({ id, label, icon: Icon, active, children }: {
  id: string; label: string; icon: LucideIcon; active: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(active);
  return <div>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className={`${rowClass} ${active ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]"}`}>
      <Icon size={18} className="shrink-0" aria-hidden /><span>{label}</span><ChevronDown size={16} aria-hidden className={`ml-auto shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    <div id={id} hidden={!open} className="mt-0.5 space-y-0.5 pb-1">{children}</div>
  </div>;
}

export function DesktopNavigation({ pathname, favoriteTeam, followedTeams, teams }: {
  pathname: string;
  favoriteTeam: Team | null | undefined;
  followedTeams: Team[];
  teams: Team[];
}) {
  const myTeams = [...new Map([...(favoriteTeam ? [favoriteTeam] : []), ...followedTeams].map((team) => [team.id, team])).values()];
  const otherTeams = teams.filter((team) => !myTeams.some((mine) => mine.id === team.id));
  const fanTalk = pathname.startsWith("/community") || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
  const matches = /^\/(schedule|matches|tournaments)(\/|$)/.test(pathname);
  const teamChannel = otherTeams.some((team) => pathname === `/fan/${team.fanSiteHost}` || pathname.startsWith(`/fan/${team.fanSiteHost}/`));
  const records = /^\/(players|champions|news)(\/|$)/.test(pathname);
  function itemLink({ href, label, icon: Icon }: NavigationItem, active = pathname === href || pathname.startsWith(`${href}/`), nested = false) {
    return <Link key={href} href={href} prefetch={href === "/tournaments" ? false : undefined} aria-current={active ? "page" : undefined} data-active={active ? "true" : undefined} className={`${nested ? subRowClass : rowClass} ${stateClass(active)}`}>{nested ? null : <Icon size={18} className="shrink-0" aria-hidden />}<span className="truncate">{label}</span></Link>;
  }
  function teamLinks(items: Team[]) {
    return items.map((team) => {
      const href = `/fan/${team.fanSiteHost}`;
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={team.id} href={href} title={team.name} aria-label={`${team.name} 팀 채널`} aria-current={active ? "page" : undefined} data-active={active ? "true" : undefined} className={`${teamRowClass} ${stateClass(active)}`}><TeamLogo team={team} size="h-[18px] w-[18px]" themeAware plain /><span className="truncate">{team.shortName}</span></Link>;
    });
  }
  return <aside className="app-lnb app-lnb-scrollbar fixed bottom-0 left-0 top-16 z-40 hidden w-[152px] overflow-y-auto border-r border-[var(--ui-border)] bg-[var(--page-background)] px-2 py-2 md:block" style={{ fontFamily: '"Pretendard", sans-serif' }}>
    <nav aria-label="데스크톱 주요 메뉴" className="space-y-0.5">
      <MenuGroup key={`matches-${matches}`} id="desktop-match-menu" label="경기" icon={CalendarDays} active={matches}>{matchMenuItems.map((item) => itemLink(item, undefined, true))}</MenuGroup>
      {itemLink({ href: "/community", label: "팬톡", icon: MessagesSquare }, fanTalk)}
      {itemLink({ href: "/transfers", label: "이적시장", icon: ArrowLeftRight })}
      {itemLink({ href: "/predictions", label: "승부예측", icon: Sparkles })}
      <MenuGroup key={`records-${records}`} id="desktop-record-menu" label="기록실" icon={ChartNoAxesColumn} active={records}>{recordMenuItems.map((item) => itemLink(item, undefined, true))}</MenuGroup>
    </nav>
    <nav aria-label="팀 채널" className="mt-2 border-t border-[var(--ui-border)] pt-2">
      {myTeams.length > 0 ? <section aria-label="내 팀" className="mb-2 space-y-0.5">
        <h2 className="flex h-9 items-center gap-2 px-2 text-[14px] font-medium text-[var(--ui-muted)]"><Heart size={18} className="shrink-0" aria-hidden /><span>내 팀</span></h2>
        {teamLinks(myTeams)}
      </section> : null}
      <MenuGroup key={`teams-${teamChannel}`} id="desktop-team-menu" label="팀 채널" icon={Shield} active={teamChannel}>{teamLinks(otherTeams)}</MenuGroup>
    </nav>
  </aside>;
}
