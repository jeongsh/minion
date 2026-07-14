"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileCoreTabs = [
  { label: "홈", segment: "" },
  { label: "일정", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "커뮤니티", segment: "community" },
  { label: "영상", segment: "videos" },
];

const mobileSecondaryTabs = [
  { label: "소셜", segment: "instagram" },
];

const desktopTabs = [
  { label: "홈", segment: "" },
  { label: "일정", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "커뮤니티", segment: "community" },
  { label: "비난양파", segment: "onion" },
  { label: "소셜", segment: "instagram" },
  { label: "영상", segment: "videos" },
];

export function FanChannelNavigation({ teamSlug }: { teamSlug: string }) {
  const pathname = usePathname();
  const home = `/fan/${teamSlug}`;
  const focusMode = new RegExp(`^/fan/${teamSlug}/community/(new|[^/]+/new|post/[^/]+/edit)$`).test(pathname);
  const hrefFor = (segment: string) => segment ? `${home}/${segment}` : home;
  const isActive = (segment: string) => segment ? pathname.startsWith(hrefFor(segment)) : pathname === home;

  if (focusMode) return null;

  return (
    <nav aria-label="팬페이지 메뉴" className="sticky top-14 z-30 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] sm:top-16">
      <div className="layout-wide flex h-12 items-stretch lg:hidden">
        {mobileCoreTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 items-center justify-center border-b-[3px] px-1 pt-0.5 text-[16px] font-bold transition-colors font-paperozi ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
        {mobileSecondaryTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-0 flex-1 items-center justify-center border-b-[3px] px-1 pt-0.5 text-[16px] font-bold transition-colors font-paperozi ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="fan-page-container fan-nav-scroll hidden gap-5 overflow-x-auto lg:flex lg:gap-7">
        {desktopTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-[3px] px-0 py-3 text-m font-bold transition-colors ${
                active
                  ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]"
                  : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
