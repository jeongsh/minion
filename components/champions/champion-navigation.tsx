import { SegmentedControl } from "@/components/ui/tabs";

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

  return <SegmentedControl ariaLabel="챔피언 포지션" activeKey={activePosition} items={positions.map(position=>({
    key:position, label:<><span>{POSITION_LABEL[position]}</span><span className="text-[13px] font-normal tabular-nums opacity-65">{counts[position] ?? 0}</span></>,
    disabled:!counts[position], scroll:false,
    href:hrefWith(basePath,params,{position,tab:params.get("tab")==="duos" && position!=="BOT" && position!=="SUP" ? "overview" : params.get("tab"),page:null}),
  }))} className="min-w-0 max-w-full overflow-x-auto" />;
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

  return <div className="champion-mobile-sticky-tabs sticky z-20 -mx-[var(--layout-gutter)] bg-[var(--page-background)] px-[var(--layout-gutter)] py-2 md:static md:mx-0 md:px-0">
    <SegmentedControl stretch activeKey={activeTab} ariaLabel="챔피언 통계 분류" className="overflow-x-auto" items={tabs.map(tab=>({
      ...tab,scroll:false,href:hrefWith(basePath,params,{tab:tab.key==="overview" ? null : tab.key,page:null}),
    }))} />
  </div>;
}
