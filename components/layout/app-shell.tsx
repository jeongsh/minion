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
        <header className="sticky top-0 z-20 border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-[var(--page-inline)] py-4 md:flex-row md:items-center md:justify-between">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">LCK Hub</span>
              <span className="text-xs text-muted">fan platform</span>
            </Link>
            <nav aria-label="주요 메뉴" className="flex flex-wrap gap-2">
              {hubNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border border-transparent px-3 py-2 text-sm text-muted hover:border-border hover:bg-surface-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
      ) : null}
      {children}
    </div>
  );
}
