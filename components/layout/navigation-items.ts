import { CalendarDays, Crown, Rss, Swords, UserRound, type LucideIcon } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

export const matchMenuItems: NavigationItem[] = [
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/tournaments", label: "대회", icon: Swords },
];

export const recordMenuItems: NavigationItem[] = [
  { href: "/players", label: "선수", icon: UserRound },
  { href: "/champions", label: "챔피언", icon: Crown },
  { href: "/news", label: "뉴스", icon: Rss },
];
