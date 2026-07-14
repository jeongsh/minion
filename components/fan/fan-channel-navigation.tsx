"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const coreTabs = [
  { label: "홈", segment: "" },
  { label: "일정", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "커뮤니티", segment: "community" },
  { label: "영상", segment: "videos" },
];

const secondaryTabs = [
  { label: "소셜", segment: "instagram" },
];

export function FanChannelNavigation({ teamSlug }: { teamSlug: string }) {
  const pathname = usePathname();
  const home = `/fan/${teamSlug}`;
  const focusMode = new RegExp(`^/fan/${teamSlug}/community/(new|[^/]+/new|post/[^/]+/edit)$`).test(pathname);
  const hrefFor = (segment: string) => segment ? `${home}/${segment}` : home;
  const isActive = (segment: string) => segment ? pathname.startsWith(hrefFor(segment)) : pathname === home;

  if (focusMode) return null;

  return (
    <nav aria-label="팬 페이지 메뉴" className="sticky top-14 z-30 border-b border-[var(--ui-border)] bg-[var(--ui-surface)]/96 backdrop-blur sm:top-16">
      <div className="layout-wide flex h-12 items-stretch sm:h-auto sm:gap-5">
        {coreTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 items-center justify-center border-b-[3px] px-1 pt-0.5 text-[12px] font-bold transition-colors sm:min-h-12 sm:flex-none sm:px-2 sm:text-sm font-paperozi ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
        <div className="hidden items-stretch gap-5 sm:flex">
          {secondaryTabs.map((tab) => {
            const href = hrefFor(tab.segment);
            const active = isActive(tab.segment);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center border-b-[3px] px-2 text-sm font-bold transition-colors ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>{tab.label}</Link>;
          })}
        </div>
        {secondaryTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 items-center justify-center border-b-[3px] px-1 pt-0.5 text-[12px] font-bold transition-colors sm:hidden font-paperozi ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
