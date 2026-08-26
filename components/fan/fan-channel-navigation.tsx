"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileCoreTabs = [
  { label: "홈", segment: "" },
  { label: "캘린더", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "커뮤니티", segment: "community" },
];

const mobileSecondaryTabs = [
  { label: "소셜", segment: "instagram" },
  { label: "영상", segment: "videos" },
];

const desktopTabs = [
  { label: "홈", segment: "" },
  { label: "캘린더", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "커뮤니티", segment: "community" },
  // { label: "비난양파", segment: "onion" },
  { label: "소셜", segment: "instagram" },
  { label: "영상", segment: "videos" },
];

export function FanChannelNavigation({ teamSlug }: { teamSlug: string }) {
  const pathname = usePathname();
  const home = `/fan/${teamSlug}`;
  const focusMode = new RegExp(`^/fan/${teamSlug}/community/(new|[^/]+/new|post/[^/]+/edit)$`).test(pathname);
  const mobilePostDetail = new RegExp(`^/fan/${teamSlug}/community/post/[^/]+$`).test(pathname);
  const hrefFor = (segment: string) => segment ? `${home}/${segment}` : home;
  const isActive = (segment: string) => segment ? pathname.startsWith(hrefFor(segment)) : pathname === home;

  if (focusMode) return null;

  return (
    <nav aria-label="팬페이지 로컬 메뉴" className={`fan-local-navigation sticky z-30 border-b border-[var(--ui-border)] bg-[var(--page-background)] transition-[top] duration-200 ${mobilePostDetail ? "hidden md:block" : ""}`}>
      <div className="flex h-12 w-full items-stretch overflow-x-auto [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {mobileCoreTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-[56px] flex-1 items-center justify-center border-b-[3px] pt-0.5 text-[14px] font-bold transition-colors font-paperozi ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>
              <span className="whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
        {mobileSecondaryTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-[56px] flex-1 items-center justify-center border-b-[3px] pt-0.5 text-[14px] font-bold transition-colors font-paperozi ${active ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]" : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"}`}>
              <span className="whitespace-nowrap">{tab.label}</span>
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
              className={`font-paperozi shrink-0 border-b-[3px] px-0 py-3 text-[14px] font-bold transition-colors ${
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
