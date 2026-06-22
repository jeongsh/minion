"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hubNavItems } from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFanSite = pathname.startsWith("/fan/");

  return (
    <div className="min-h-screen">
      {!isFanSite ? (
        <header className="sticky top-0 z-20 border-b border-[#e8eaf0] bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[72px] max-w-[1180px] items-center gap-6 px-5">
            <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="LCK Hub 홈">
              <span className="text-lg font-black text-[#111827]">LCK</span>
              <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-black text-white">
                HUB
              </span>
            </Link>

            <nav
              aria-label="주요 메뉴"
              className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
            >
              {hubNavItems
                .filter((item) => item.label !== "관리")
                .map((item) => {
                  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative whitespace-nowrap px-3 py-[26px] text-sm font-black transition-colors ${
                        isActive
                          ? "text-accent"
                          : "text-[#667085] hover:text-[#111827]"
                      }`}
                    >
                      {item.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent" />
                      )}
                    </Link>
                  );
                })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <label className="hidden h-9 w-44 items-center gap-2 rounded-lg border border-[#e0e4eb] bg-[#f8f9fc] px-3 text-sm text-[#98a2b3] md:flex">
                <span className="sr-only">검색</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-[#98a2b3]"
                  placeholder="팀·선수 검색"
                />
                <span aria-hidden="true" className="text-base">⌕</span>
              </label>
              <Link
                href="/admin"
                className="hidden h-9 items-center rounded-lg border border-[#e8eaf0] px-3.5 text-sm font-bold text-[#667085] transition-colors hover:border-accent hover:text-accent md:flex"
              >
                관리
              </Link>
            </div>
          </div>

          {/* 모바일 서브 메뉴 */}
          <nav
            aria-label="모바일 메뉴"
            className="scrollbar-none flex gap-1 overflow-x-auto border-t border-[#f0f2f5] px-4 pb-2 pt-1.5 lg:hidden"
          >
            {hubNavItems
              .filter((item) => item.label !== "관리")
              .map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-[#667085] hover:bg-[#f4f5f8] hover:text-[#111827]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </header>
      ) : null}
      {children}
    </div>
  );
}
