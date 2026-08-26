import Link from "next/link";

import type { PlayerPosition } from "@/lib/types";

export type ChampionDetailTab = "overview" | "matchups" | "duos" | "pros" | "games" | "stats";

const POSITION_LABEL: Record<PlayerPosition, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "바텀",
  SUP: "서포터",
};

function hrefWith(basePath: string, params: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || (value === "all" && (key === "patch" || key === "tournament"))) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function ChampionPositionNav({
  basePath,
  params,
  activePosition,
  counts,
}: {
  basePath: string;
  params: URLSearchParams;
  activePosition: PlayerPosition;
  counts: Record<PlayerPosition, number>;
}) {
  const positions: PlayerPosition[] = ["TOP", "JGL", "MID", "BOT", "SUP"];

  return (
    <nav aria-label="챔피언 포지션" className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {positions.map((position) => {
        const count = counts[position] ?? 0;
        const active = position === activePosition;
        const content = (
          <>
            <span>{POSITION_LABEL[position]}</span>
            <span className="tabular-nums text-[13px] font-normal opacity-65">{count}</span>
          </>
        );
        const className = `flex h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-[14px] transition-colors ${
          active
            ? "bg-[var(--ui-ink)] font-medium text-[var(--ui-surface)]"
            : count > 0
              ? "font-medium text-[var(--ui-muted)] hover:bg-[var(--ui-card-bg)] hover:text-[var(--ui-ink)]"
              : "cursor-not-allowed font-normal text-[var(--ui-muted)] opacity-35"
        }`;

        return count > 0 ? (
          <Link
            key={position}
            href={hrefWith(basePath, params, {
              position,
              tab: params.get("tab") === "duos" && position !== "BOT" && position !== "SUP" ? "overview" : params.get("tab"),
              page: null,
            })}
            aria-current={active ? "page" : undefined}
            className={className}
            scroll={false}
          >
            {content}
          </Link>
        ) : (
          <span key={position} className={className} aria-disabled="true">
            {content}
          </span>
        );
      })}
    </nav>
  );
}

export function ChampionTabNav({
  basePath,
  params,
  activeTab,
  position,
}: {
  basePath: string;
  params: URLSearchParams;
  activeTab: ChampionDetailTab;
  position: PlayerPosition;
}) {
  const tabs: Array<{ key: ChampionDetailTab; label: string }> = [
    { key: "overview", label: "빌드" },
    { key: "matchups", label: "상대 전적" },
    ...((position === "BOT" || position === "SUP") ? [{ key: "duos" as const, label: "바텀 조합" }] : []),
    { key: "pros", label: "선수" },
    { key: "games", label: "경기" },
    { key: "stats", label: "통계" },
  ];

  return (
    <nav
      aria-label="챔피언 통계 분류"
      className="champion-mobile-sticky-tabs sticky z-20 -mx-[var(--layout-gutter)] bg-[var(--page-background)] px-[var(--layout-gutter)] py-2 md:static md:mx-0 md:max-w-full md:rounded-[10px] md:bg-[var(--ui-card-bg)] md:p-[3px]"
    >
      <div className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-[var(--ui-card-bg)] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-flow-col md:auto-cols-fr md:gap-0.5 md:overflow-visible md:rounded-none md:bg-transparent md:p-0">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={hrefWith(basePath, params, { tab: tab.key === "overview" ? null : tab.key, page: null })}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 min-w-[3.9rem] flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-medium transition-colors md:min-w-[4.5rem] md:flex-none md:px-3 md:text-[14px] ${
                active
                  ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)] md:border-[var(--ui-border)] md:bg-[var(--ui-surface)] md:text-[var(--ui-ink)]"
                  : "border-transparent text-[var(--ui-muted)] hover:bg-[var(--ui-surface)] hover:text-[var(--ui-ink)]"
              }`}
              scroll={false}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
