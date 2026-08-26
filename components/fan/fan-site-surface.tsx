"use client";

import { usePathname } from "next/navigation";

export function FanSiteSurface({
  teamSlug,
  style,
  children,
}: {
  teamSlug: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCalendarPage = pathname === `/fan/${teamSlug}/matches`;

  return (
    <div className={`team-surface ${isCalendarPage ? "" : "min-h-[calc(100vh-73px)]"}`} style={style}>
      {children}
    </div>
  );
}
