// 티어 배지. 티어를 받아 한글 라벨과 함께 렌더한다.
// 색은 CSS variable 토큰으로 정의하고, 구조는 semantic + Tailwind 레이아웃 위주.

import { TIER_LABELS, type Tier } from "@/lib/rank/config";

// 각 티어 대표 색(추후 디자이너가 토큰으로 교체 가능하도록 inline CSS variable로 주입).
const TIER_COLORS: Record<Tier, string> = {
  iron: "#6b7280",
  bronze: "#a16207",
  silver: "#94a3b8",
  gold: "#d4a017",
  platinum: "#2dd4bf",
  emerald: "#10b981",
  diamond: "#38bdf8",
  master: "#a855f7",
  grandmaster: "#ef4444",
  challenger: "#f59e0b",
};

type RankBadgeProps = {
  tier: Tier;
  lp?: number;
  size?: "sm" | "md";
  className?: string;
};

export function RankBadge({ tier, lp, size = "sm", className }: RankBadgeProps) {
  const label = TIER_LABELS[tier] ?? tier;
  const color = TIER_COLORS[tier] ?? "#6b7280";

  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-sm gap-1.5"
      : "px-2 py-0.5 text-xs gap-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold ${sizeClasses} ${className ?? ""}`}
      style={
        {
          "--tier-color": color,
          color: "var(--tier-color)",
          borderColor: "color-mix(in srgb, var(--tier-color) 40%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--tier-color) 12%, transparent)",
        } as React.CSSProperties
      }
      title={typeof lp === "number" ? `${label} · ${lp} LP` : label}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: "var(--tier-color)" }}
      />
      <span>{label}</span>
      {typeof lp === "number" ? (
        <span className="font-semibold opacity-80">{lp} LP</span>
      ) : null}
    </span>
  );
}
