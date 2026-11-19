"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UnderlineNav } from "@/components/ui/tabs";

// 모바일은 소셜과 영상을 미디어 탭 하나로 묶고, 미디어 화면 안에서 둘을 전환한다.
const mobileTabs = [
  { label: "홈", segment: "" },
  { label: "팬톡", segment: "community" },
  { label: "일정", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "미디어", segment: "instagram", alsoActive: "videos" },
];

const desktopTabs = [
  { label: "홈", segment: "" },
  { label: "팬톡", segment: "community" },
  { label: "일정", segment: "matches" },
  { label: "선수", segment: "players" },
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
    <div data-ad-secondary-header className={`fan-local-navigation sticky z-30 border-[var(--ui-border)] bg-[var(--page-background)] transition-[top] duration-200 lg:border-b ${mobilePostDetail ? "hidden md:block" : ""}`}>
      <UnderlineNav
        items={mobileTabs.map((tab) => ({ key: tab.segment, label: tab.label, href: hrefFor(tab.segment), prefetch: false }))}
        activeKey={mobileTabs.find((tab) => isActive(tab.segment) || (tab.alsoActive ? isActive(tab.alsoActive) : false))?.segment ?? "__none__"}
        ariaLabel="팬페이지 로컬 메뉴"
        className="font-paperozi lg:hidden [--accent:var(--team-accent-text)]"
        spread
      />

      <nav aria-label="팬페이지 로컬 메뉴" className="fan-page-container fan-nav-scroll hidden gap-5 overflow-x-auto lg:flex lg:gap-7">
        {desktopTabs.map((tab) => {
          const href = hrefFor(tab.segment);
          const active = isActive(tab.segment);
          return (
            <Link
              prefetch={false}
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`font-paperozi shrink-0 border-b-[3px] px-0 py-3 text-[15px] font-bold transition-colors ${
                active
                  ? "border-[var(--team-accent-text)] text-[var(--team-accent-text)]"
                  : "border-transparent text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
