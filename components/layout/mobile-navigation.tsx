"use client";

import Link from "next/link";
import { ArrowLeftRight, CalendarDays, ChartNoAxesColumn, Heart, Home, MessagesSquare, Shield, Sparkles } from "lucide-react";
import { FanTeamPicker, TeamPicker } from "@/components/layout/fan-team-picker";
import { TeamLogo } from "@/components/ui/team-logo";
import { matchMenuItems, recordMenuItems } from "@/components/layout/navigation-items";
import type { Team } from "@/lib/types";

const dockItemClass = "font-paperozi relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[11px] font-medium";
const colorClass = (active: boolean) => active ? "text-[var(--ui-ink)]" : "text-[#777b82]";
const directItems = [
  { href: "/transfers", label: "이적시장", icon: ArrowLeftRight },
  { href: "/predictions", label: "승부예측", icon: Sparkles },
  { href: "/players", label: "기록실", icon: ChartNoAxesColumn },
];
// 승부예측은 경기에 붙는 기능이라 모바일 경기 섹션에도 둔다. 홈 바로가기와 데스크톱 최상위 자리는 유지한다.
const mobileMatchItems = [...matchMenuItems, { href: "/predictions", label: "승부예측", icon: Sparkles }];
const matchSection = /^\/(schedule|matches|tournaments|predictions)(\/|$)/;
// LCK 팬톡은 팀 팬톡의 팀 메뉴(홈·팬톡·캘린더·선수…)와 같은 자리에 LCK 채널 메뉴를 둬 칩 전환 시 높이를 맞춘다.
const lckChannelItems = [
  { href: "/", label: "홈" },
  { href: "/community", label: "팬톡" },
  { href: "/schedule", label: "일정" },
  { href: "/players", label: "선수" },
  { href: "/news", label: "뉴스" },
];

export function MobileLocalNavigation({ pathname }: { pathname: string }) {
  const items = /^\/community(\/|$)/.test(pathname)
    ? lckChannelItems
    : matchSection.test(pathname)
    ? mobileMatchItems
    : /^\/(players|champions|news)(\/|$)/.test(pathname)
      ? recordMenuItems
      : directItems;
  return <nav aria-label="허브 로컬 메뉴" className="hub-local-navigation sticky z-30 border-b border-[var(--ui-border)] bg-[var(--page-background)] transition-[top] duration-200 md:hidden">
    <div className="flex h-12 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(({ href, label }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ||(href === "/schedule" && pathname.startsWith("/matches/"));
        return <Link key={href} href={href} prefetch={href === "/tournaments" ? false : undefined} aria-current={active ? "page" : undefined} className={`font-paperozi flex shrink-0 items-center justify-center whitespace-nowrap border-b-[3px] px-4 pt-0.5 text-[14px] font-medium transition-colors ${active ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>{label}</Link>;
      })}
    </div>
  </nav>;
}

export function MobileNavigation({ pathname, favoriteTeam, followedTeams, teams, currentTeam }: {
  pathname: string; favoriteTeam?: Team | null; followedTeams: Team[]; teams: Team[]; currentTeam?: Team | null;
}) {
  const fanTalk = pathname === "/community" || pathname.startsWith("/community/") || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
  const items = [
    { href: "/", label: "홈", icon: Home, active: pathname === "/" },
    { href: "/schedule", label: "매치", icon: CalendarDays, active: matchSection.test(pathname) },
    { href: "/fan", label: "팬", icon: Heart, active: !fanTalk && pathname.startsWith("/fan/") },
    { href: "/teams", label: "팀", icon: Shield, active: pathname === "/teams" },
    { href: "/community", label: "팬톡", icon: MessagesSquare, active: fanTalk },
  ];
  return <nav aria-label="모바일 주요 메뉴" className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(52px+env(safe-area-inset-bottom))] items-start border-t border-[#e8e8eb] bg-[var(--page-background)] pt-1 backdrop-blur md:hidden dark:border-[var(--ui-border)]">
    {items.map(({ href, label, icon: Icon, active }) => {
      const className = `${dockItemClass} ${colorClass(active)}`;
      if (href === "/teams") return <TeamPicker key={href} teams={teams} followedTeams={followedTeams} active={active} className={className} />;
      if (href === "/fan" && !favoriteTeam) return <FanTeamPicker key={href} teams={teams} followedTeams={followedTeams} currentTeam={currentTeam} active={active} className={className} />;
      const destination = href === "/fan" && favoriteTeam ? `/fan/${favoriteTeam.fanSiteHost}` : href === "/community" && favoriteTeam ? `/fan/${favoriteTeam.fanSiteHost}/community` : href;
      return <Link key={href} href={destination} aria-current={active ? "page" : undefined} className={className}>
        <span className={`relative grid place-items-center ${href === "/fan" && favoriteTeam ? "-mt-5 h-10 w-10 overflow-hidden rounded-full border-[3px] border-[var(--page-background)] bg-[var(--ui-surface-muted)]" : "h-5 w-5"}`}>{href === "/fan" && favoriteTeam ? <TeamLogo team={favoriteTeam} size="h-7 w-7" themeAware plain /> : <Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />}</span>
        <span className="max-w-full truncate">{label}</span>
      </Link>;
    })}
  </nav>;
}
