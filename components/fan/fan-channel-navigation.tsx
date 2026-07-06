"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "홈", segment: "" },
  { label: "일정", segment: "matches" },
  { label: "선수", segment: "players" },
  { label: "커뮤니티", segment: "community" },
  { label: "소셜", segment: "instagram" },
  { label: "영상", segment: "videos" },
];

export function FanChannelNavigation({ teamSlug }: { teamSlug: string }) {
  const pathname = usePathname();
  const home = `/fan/${teamSlug}`;

  return (
    <nav aria-label="팬페이지 메뉴" className="sticky top-16 z-30 border-b border-[#e8e8eb] bg-[var(--ui-surface)]/95 backdrop-blur dark:border-[#383c44]">
      <div className="mx-auto flex max-w-[1400px] gap-7 overflow-x-auto px-5">
        {tabs.map((tab) => {
          const href = tab.segment ? `${home}/${tab.segment}` : home;
          const active = tab.segment ? pathname.startsWith(`${href}`) : pathname === home;
          return (
            <Link
              key={href}
              href={href}
              className={`shrink-0 border-b-[3px] py-3 px-2 text-m font-paperozi transition-colors ${
                active ? "border-[var(--team-primary)] text-[var(--team-primary)]" : "border-transparent text-[#6f737a] hover:text-[#18191c]"
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
