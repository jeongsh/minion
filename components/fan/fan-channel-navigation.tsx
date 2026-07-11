"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
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

  return (
    <nav
      aria-label="팬페이지 메뉴"
      className="sticky top-16 z-30 border-b border-[var(--ui-border)] bg-[var(--ui-surface)]"
    >
      <div className="fan-nav-scroll mx-auto flex max-w-[1400px] gap-5 overflow-x-auto px-5 sm:gap-7">
        {tabs.map((tab) => {
          const href = tab.segment ? `${home}/${tab.segment}` : home;
          const active = tab.segment ? pathname.startsWith(href) : pathname === home;
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 border-b-[3px] px-2 py-3 text-m font-bold transition-colors ${
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
