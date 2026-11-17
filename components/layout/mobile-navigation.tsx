"use client";

import Link from "next/link";
import { CalendarDays, ChartNoAxesColumn, Heart, Home, MessagesSquare } from "lucide-react";
import { TeamPicker } from "@/components/layout/fan-team-picker";
import { TeamLogo } from "@/components/ui/team-logo";
import { UnderlineNav } from "@/components/ui/tabs";
import type { Team } from "@/lib/types";

const dockItemClass = "font-paperozi relative flex min-w-0 flex-col items-center gap-0.5 px-1 py-1 text-[11px] font-medium";
const colorClass = (active: boolean) => active ? "text-[var(--ui-ink)]" : "text-[#777b82]";

// 하단 독 구역마다 로컬 탭을 하나씩 둔다. 상세 페이지는 로컬 탭 대신 뒤로가기 헤더를 쓴다.
const localNavigationGroups = [
  {
    pattern: /^\/(transfers|news)?$/,
    items: [
      { href: "/", label: "홈" },
      { href: "/transfers", label: "이적시장" },
      { href: "/news", label: "뉴스" },
    ],
  },
  {
    pattern: /^\/(schedule|predictions|tournaments)(\/[^/]+)?$/,
    items: [
      { href: "/schedule", label: "일정" },
      { href: "/predictions", label: "승부예측" },
      { href: "/tournaments", label: "대회" },
    ],
  },
  {
    pattern: /^\/(players|champions)$/,
    items: [
      { href: "/players", label: "선수" },
      { href: "/champions", label: "챔피언" },
    ],
  },
];

const homeSection = /^\/$|^\/(transfers|news)(\/|$)/;
const matchSection = /^\/(schedule|matches|tournaments|predictions)(\/|$)/;
const recordSection = /^\/(players|champions)(\/|$)/;

function localNavigationItems(pathname: string) {
  if (pathname === "/predictions/report") return null;
  return localNavigationGroups.find(({ pattern }) => pattern.test(pathname))?.items ?? null;
}

export function hasMobileLocalNavigation(pathname: string) {
  return localNavigationItems(pathname) !== null;
}

export function MobileLocalNavigation({ pathname }: { pathname: string }) {
  const items = localNavigationItems(pathname);
  if (!items) return null;
  const activeItem = items.find(({ href }) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)));
  return <div className="hub-local-navigation sticky z-30 bg-[var(--page-background)] transition-[top] duration-200 md:hidden">
    <UnderlineNav
      items={items.map(({ href, label }) => ({ key: href, href, label, prefetch: href === "/tournaments" ? false : undefined }))}
      activeKey={activeItem?.href ?? ""}
      ariaLabel="허브 로컬 메뉴"
      className="font-paperozi"
      spread
    />
  </div>;
}

export function MobileNavigation({ pathname, favoriteTeam, followedTeams, teams }: {
  pathname: string; favoriteTeam?: Team | null; followedTeams: Team[]; teams: Team[];
}) {
  const fanTalk = pathname === "/community" || pathname.startsWith("/community/") || /^\/fan\/[^/]+\/community(?:\/|$)/.test(pathname);
  const items = [
    { href: "/", label: "홈", icon: Home, active: homeSection.test(pathname) },
    { href: "/schedule", label: "매치", icon: CalendarDays, active: matchSection.test(pathname) },
    { href: "/fan", label: "팀", icon: Heart, active: !fanTalk && (pathname.startsWith("/fan/") || pathname === "/teams") },
    { href: "/players", label: "기록실", icon: ChartNoAxesColumn, active: recordSection.test(pathname) },
    { href: "/community", label: "팬톡", icon: MessagesSquare, active: fanTalk },
  ];
  return <nav aria-label="모바일 주요 메뉴" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 h-[calc(52px+env(safe-area-inset-bottom))] items-start border-t border-[#e8e8eb] bg-[var(--page-background)] pt-1 backdrop-blur md:hidden dark:border-[var(--ui-border)]">
    {items.map(({ href, label, icon: Icon, active }) => {
      const className = `${dockItemClass} ${colorClass(active)}`;
      // 최애팀이 있으면 바로 그 팀 채널로 간다. 팀 전환은 팀 채널 헤더의 스위처에서 한다.
      if (href === "/fan" && !favoriteTeam) return <TeamPicker key={href} teams={teams} followedTeams={followedTeams} favoriteTeam={favoriteTeam} active={active} className={className} />;
      if (href === "/fan" && favoriteTeam) return <Link key={href} href={`/fan/${favoriteTeam.fanSiteHost}`} aria-current={active ? "page" : undefined} className={className}>
        <span className="relative -mt-5 grid h-10 w-10 place-items-center overflow-hidden rounded-full border-[3px] border-[var(--page-background)] bg-[var(--ui-surface-muted)]"><TeamLogo team={favoriteTeam} size="h-7 w-7" themeAware plain /></span>
        <span className="max-w-full truncate">{label}</span>
      </Link>;
      const destination = href === "/community" && favoriteTeam ? `/fan/${favoriteTeam.fanSiteHost}/community` : href;
      return <Link key={href} href={destination} aria-current={active ? "page" : undefined} className={className}>
        <span className="relative grid h-5 w-5 place-items-center"><Icon size={20} strokeWidth={active ? 2.5 : 2} aria-hidden /></span>
        <span className="max-w-full truncate">{label}</span>
      </Link>;
    })}
  </nav>;
}
