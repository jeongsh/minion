"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { fanNavItems } from "@/lib/navigation";
import type { Team } from "@/lib/types";

function isActive(href: string, pathname: string) {
  if (href === pathname) return true;
  return href !== `/fan/${pathname.split("/")[2]}` && pathname.startsWith(`${href}/`);
}

export function FanSiteNavigation({ team }: { team: Team }) {
  const pathname = usePathname();
  const items = fanNavItems(team.fanSiteHost);

  return (
    <div className="sticky top-[72px] z-30 border-b border-[#e8eaf0] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 sm:px-6">
        <Link
          href={`/fan/${team.fanSiteHost}`}
          className="hidden shrink-0 items-center gap-2 pr-3 sm:flex"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-sm font-black text-[#111827]">{team.shortName} 팬 허브</span>
        </Link>

        <nav
          aria-label={`${team.name} 팬페이지 메뉴`}
          className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {items.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 shrink-0 items-center px-3 text-sm font-bold transition-colors ${
                  active ? "text-accent" : "text-[#667085] hover:text-[#111827]"
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/teams"
          className="hidden shrink-0 rounded-full border border-[#e2e6ee] px-3 py-1.5 text-xs font-bold text-[#667085] transition hover:border-accent hover:text-accent md:inline-flex"
        >
          전체 팀
        </Link>
      </div>
    </div>
  );
}
