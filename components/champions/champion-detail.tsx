import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { PlayerItemSlots } from "@/app/matches/[matchId]/player-item-slots";
import { ChampionPicker, type ChampionPickerOption } from "@/components/champions/champion-picker";
import { ChampionUrlDropdown } from "@/components/champions/champion-url-dropdown";
import { SkillBuildTimeline } from "@/components/domain/skill-build-timeline";
import {
  ChampionTabNav,
  type ChampionDetailTab,
} from "@/components/champions/champion-navigation";
import {
  EmptyPanel,
  formatNumber,
  formatPercent,
  formatSigned,
  PercentageBar,
  SampleBadge,
  SectionCard,
} from "@/components/champions/champion-ui";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  buildCompletedItemSequenceSummaries,
  type ChampionAnalysis,
  type ChampionDuo,
  type ChampionMatchup,
  type NumericPreference,
  type NumericTuplePreference,
  type ChampionPlayerPreference,
  type CompletedItemSequenceSummary,
} from "@/lib/champion-analysis";
import { championImage, type ChampionAbilityIcons } from "@/lib/champions";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import {
  isCompletedCompetitiveItem,
  itemImageUrl,
  itemLabel,
  type DetailedGameItem,
  type GameItem,
} from "@/lib/items";
import {
  buildRuneBuildGrid,
  resolveRunePairUrls,
  runeLabel,
  type DdragonRuneTree,
  type RuneBuildGrid,
  type RuneCatalog,
  type RuneGridOption,
} from "@/lib/runes";
import { spellImageUrlById, spellLabel, type GameSpell } from "@/lib/spells";
import type { Champion, Player, PlayerPosition } from "@/lib/types";

const POSITION_LABEL: Record<PlayerPosition, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "바텀",
  SUP: "서포터",
};

export type ChampionCatalogs = {
  version: string;
  items: GameItem[];
  detailedItems: DetailedGameItem[];
  detailedItemsByVersion: Record<string, DetailedGameItem[]>;
  itemImageVersionById: Record<string, string>;
  spells: GameSpell[];
  runeCatalog: RuneCatalog;
  runeTrees: DdragonRuneTree[];
  abilityIcons: ChampionAbilityIcons | null;
  catalogFailures: {
    itemVersions: string[];
    spells: boolean;
    runes: boolean;
  };
};

function buildHref(basePath: string, params: URLSearchParams, changes: Record<string, string | number | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value == null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function compactTournamentLabel(value: string | null) {
  const name = value?.trim();
  if (!name) return "대회";

  const normalized = name.toUpperCase();
  const knownLeagues: Array<[RegExp, string]> = [
    [/\bLCK\s*(?:CHALLENGERS|CL)\b/, "LCK CL"],
    [/\bLCK\b/, "LCK"],
    [/KESPA/, "KeSPA"],
    [/\bMSI\b|MID[- ]SEASON INVITATIONAL/, "MSI"],
    [/\bWORLDS?\b|WORLD CHAMPIONSHIP/, "Worlds"],
    [/\bEWC\b|ESPORTS WORLD CUP/, "EWC"],
    [/\bLEC\b/, "LEC"],
    [/\bLPL\b/, "LPL"],
    [/\bLCP\b/, "LCP"],
    [/\bLTA\b/, "LTA"],
    [/\bPCS\b/, "PCS"],
    [/\bVCS\b/, "VCS"],
  ];
  const known = knownLeagues.find(([pattern]) => pattern.test(normalized));
  if (known) return known[1];

  return name
    .replace(/\b20\d{2}\b.*$/i, "")
    .replace(/\b(?:spring|summer|split|season|rounds?|playoffs?).*$/i, "")
    .trim() || name;
}

function CoverageText({ recorded, total }: { recorded: number; total: number }) {
  return <span className="tabular-nums">{recorded}/{total}경기</span>;
}

function PlayerAvatar({ player, size = "md" }: { player: Player | null; size?: "xs" | "sm" | "md" }) {
  const dimension = size === "xs" ? "h-8 w-8" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  if (player?.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={player.profileImageUrl} alt="" className={`${dimension} shrink-0 rounded-full bg-[var(--ui-card-bg)] object-cover object-top`} loading="lazy" />
    );
  }
  return (
    <span className={`${dimension} grid shrink-0 place-items-center rounded-full bg-[var(--ui-card-bg)] text-[13px] font-medium text-[var(--ui-muted)]`}>
      {player?.name.slice(0, 2) ?? "-"}
    </span>
  );
}

function ChampionFace({ champion, size = "md" }: { champion: Champion | null | undefined; size?: "xs" | "sm" | "md" }) {
  const dimension = size === "xs" ? "h-8 w-8" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={championImage(champion ?? undefined)} alt="" className={`${dimension} shrink-0 rounded-lg object-cover`} loading="lazy" />
  );
}

function ChampionHeader({
  champion,
  analysis,
  pickerOptions,
  pickerQuery,
  scopeControl,
}: {
  champion: Champion;
  analysis: ChampionAnalysis;
  pickerOptions: ChampionPickerOption[];
  pickerQuery: string;
  scopeControl: ReactNode;
}) {
  const { overview } = analysis;
  const selected = overview.selected;
  const positionOptions = overview.positions
    .filter((item) => item.picks > 0)
    .map((item) => ({ value: item.position, label: `${POSITION_LABEL[item.position]} · ${item.picks}픽` }));
  const summaryMetrics = [
    { label: "픽", value: selected.picks },
    { label: "밴", value: overview.draft.bans },
    { label: "픽밴률", value: formatPercent(overview.draft.presenceRate, 1) },
    { label: "승률", value: formatPercent(selected.winRate, 1) },
    {
      label: "전적",
      value: (
        <>
          <span className="sm:hidden" aria-label={`${selected.wins}승 ${selected.losses}패`}>{selected.wins}-{selected.losses}</span>
          <span className="hidden sm:inline">{selected.wins}승 {selected.losses}패</span>
        </>
      ),
    },
  ];

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={championImage(champion)} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-[var(--ui-card-bg)] object-cover sm:h-20 sm:w-20 sm:rounded-2xl" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
              <h1 className="truncate font-paperozi text-[18px] leading-tight text-[var(--ui-ink)] sm:text-[20px] md:text-[24px] lg:text-[28px]">{champion.name}</h1>
              <ChampionPicker champions={pickerOptions} currentChampionId={champion.id} preservedQuery={pickerQuery} compact />
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[13px] font-normal text-[var(--ui-muted)] sm:mt-1 sm:text-[14px]">
              <ChampionUrlDropdown
                ariaLabel="포지션 선택"
                options={positionOptions}
                selected={selected.position}
                paramName="position"
                resetKeys={["page"]}
                omitValues={[]}
                triggerClassName="h-8 min-h-8 px-0 !text-[13px] !font-medium [&_svg]:size-4 sm:h-9 sm:min-h-9 sm:!text-[14px] sm:[&_svg]:size-5"
              />
            </div>
          </div>
        </div>
        <div className="min-w-0 lg:pt-1">{scopeControl}</div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <div className="grid h-9 grid-cols-5 items-center bg-[var(--ui-card-bg)] text-center text-[13px] font-normal leading-tight text-[var(--ui-muted)]">
          {summaryMetrics.map((metric) => <span key={metric.label} className="min-w-0 px-1">{metric.label}</span>)}
        </div>
        <div className="grid min-h-12 grid-cols-5 items-center divide-x divide-[var(--ui-border)] text-center">
          {summaryMetrics.map((metric) => (
            <strong key={metric.label} className="min-w-0 truncate px-1 text-[15px] font-bold leading-none tracking-tight tabular-nums text-[var(--ui-ink)] sm:text-[18px] sm:tracking-normal">
              {metric.value}
            </strong>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuildStats({ games, winRate }: { games: number; winRate: number }) {
  return (
    <span
      aria-label={`승률 ${formatPercent(winRate, 1)}, ${games}세트`}
      className="flex w-[7.5rem] shrink-0 items-baseline justify-end gap-2 whitespace-nowrap text-right tabular-nums"
    >
      <strong className="text-[15px] font-bold text-[var(--ui-ink)]">{formatPercent(winRate, 1)}</strong>
      <span className="text-[13px] font-normal text-[var(--ui-muted)]">{games}세트</span>
    </span>
  );
}

function BuildPanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h4 className="text-[15px] font-bold leading-5 text-[var(--ui-ink)]">{children}</h4>
    </div>
  );
}

function RuneIcon({ rune, keystone = false, shard = false }: { rune: RuneGridOption; keystone?: boolean; shard?: boolean }) {
  const size = keystone ? "h-9 w-9 sm:h-10 sm:w-10" : shard ? "h-5 w-5 sm:h-6 sm:w-6" : "h-7 w-7 sm:h-8 sm:w-8";
  const padding = keystone || shard ? "p-1" : "p-0.5";
  const background = shard ? "bg-[#cdd0d6] dark:bg-[#24272d]" : "bg-[#d9dce2] dark:bg-[#24272d]";
  return (
    <span title={rune.name} className={`relative block shrink-0 rounded-full ${background} ${size}`}>
      {rune.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={rune.url} alt={rune.name} className={`h-full w-full object-contain ${padding} ${rune.selected ? "opacity-100" : "opacity-[0.32] grayscale"}`} loading="lazy" />
      ) : null}
    </span>
  );
}

function RuneRow({ row, keystone = false, shard = false }: { row: RuneGridOption[]; keystone?: boolean; shard?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 sm:gap-2 ${keystone ? "min-h-[42px] sm:min-h-[48px]" : shard ? "min-h-[28px] sm:min-h-[32px]" : "min-h-[38px] sm:min-h-[43px]"}`}>
      {row.map((rune) => <RuneIcon key={rune.name} rune={rune} keystone={keystone} shard={shard} />)}
    </div>
  );
}

function RuneColumn({ icon, name, rows, primary = false }: { icon?: string; name: string; rows: RuneGridOption[][]; primary?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex h-8 items-center justify-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {icon ? <img src={icon} alt="" className="h-5 w-5 shrink-0 object-contain" /> : null}
        <span className="text-[14px] font-medium text-[var(--ui-text)]">{name}</span>
      </div>
      <div className="mt-1">
        {rows.map((row, index) => <RuneRow key={`${name}-${index}`} row={row} keystone={primary && index === 0} />)}
      </div>
    </div>
  );
}

function RuneGridView({ grid }: { grid: RuneBuildGrid }) {
  return (
    <div className="mx-auto mt-1 grid w-full max-w-[440px] flex-1 grid-cols-2 items-start gap-2">
      <RuneColumn icon={grid.primaryTreeIcon} name={grid.primaryTreeName} rows={grid.primaryRows} primary />
      <div className="min-w-0">
        <RuneColumn icon={grid.secondaryTreeIcon} name={grid.secondaryTreeName} rows={grid.secondaryRows} />
        <div className="mt-2 min-w-0" aria-label="능력치 파편">
          {grid.shardRows.map((row, index) => <RuneRow key={`능력치 파편-${index}`} row={row} shard />)}
        </div>
      </div>
    </div>
  );
}

function ItemIcon({ id, catalogs, size = "md" }: { id: number; catalogs: ChampionCatalogs; size?: "sm" | "md" | "lg" }) {
  const version = catalogs.itemImageVersionById[String(id)] ?? catalogs.version;
  const dimension = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-9 w-9" : "h-8 w-8";
  const label = itemLabel(catalogs.items, id);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={itemImageUrl(id, version)} alt={label} title={label} className={`${dimension} shrink-0 rounded-md bg-[var(--ui-card-bg)] object-cover`} loading="lazy" />
  );
}

function PopularItemGroup({
  title,
  items,
  catalogs,
}: {
  title: string;
  items: NumericPreference[];
  catalogs: ChampionCatalogs;
}) {
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-[15px] font-bold leading-5 text-[var(--ui-ink)]">{title}</h4>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.id}
              aria-label={`${itemLabel(catalogs.items, item.id)} 선택률 ${formatPercent(item.selectionRate, 1)}, 승률 ${formatPercent(item.winRate, 1)}`}
              className="w-10 shrink-0 text-center"
            >
              <ItemIcon id={item.id} catalogs={catalogs} size="lg" />
              <span className="mt-1 block text-[13px] font-medium tabular-nums text-[var(--ui-ink)]">{formatPercent(item.selectionRate, 0)}</span>
            </span>
          ))}
        </div>
      ) : <span className="text-[14px] font-normal text-[var(--ui-muted)]">-</span>}
    </div>
  );
}

function CatalogNotice({ children }: { children: ReactNode }) {
  return <p className="mx-4 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-normal leading-5 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 sm:mx-5">{children}</p>;
}

function BuildSequenceRow({ sequence, catalogs }: { sequence: CompletedItemSequenceSummary; catalogs: ChampionCatalogs }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div className="flex min-w-0 items-start gap-1">
        {sequence.ids.map((id, index) => (
          <span key={`${id}:${index}`} className="flex shrink-0 items-start gap-1">
            {index > 0 ? (
              <span aria-hidden="true" className="grid h-9 w-2 shrink-0 place-items-center text-[var(--ui-muted)]">
                <ChevronRight className="h-3 w-3 opacity-60" />
              </span>
            ) : null}
            <span className="min-w-0">
              <ItemIcon id={id} catalogs={catalogs} size="lg" />
              <span className="mt-1 block text-center text-[13px] font-medium tabular-nums text-[var(--ui-muted)]">{formatNumber(sequence.averageMinutes[index], 0)}분</span>
            </span>
          </span>
        ))}
      </div>
      <BuildStats games={sequence.games} winRate={sequence.winRate} />
    </div>
  );
}

type DepthItemSummary = {
  id: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
};

function buildDepthItemSummaries(sequences: CompletedItemSequenceSummary[], depth: number): DepthItemSummary[] {
  const groups = new Map<number, DepthItemSummary>();

  for (const sequence of sequences) {
    const id = sequence.ids[depth - 1];
    if (!id) continue;
    const current = groups.get(id) ?? { id, games: 0, wins: 0, losses: 0, winRate: 0 };
    current.games += sequence.games;
    current.wins += sequence.wins;
    current.losses += sequence.losses;
    groups.set(id, current);
  }

  return [...groups.values()]
    .map((item) => ({
      ...item,
      winRate: item.wins + item.losses ? (item.wins / (item.wins + item.losses)) * 100 : 0,
    }))
    .sort((left, right) => right.games - left.games || right.wins - left.wins)
    .slice(0, 5);
}

function DepthItemList({ items, catalogs }: { items: DepthItemSummary[]; catalogs: ChampionCatalogs }) {
  if (!items.length) return <p className="py-3 text-[14px] font-normal text-[var(--ui-muted)]">표본 부족</p>;

  return (
    <div className="grid gap-1">
      {items.map((item) => (
        <div key={item.id} className="flex min-h-10 items-center gap-2 rounded-md bg-[var(--ui-surface)] px-2 py-1">
          <ItemIcon id={item.id} catalogs={catalogs} size="lg" />
          <span className="min-w-0 flex-1" />
          <BuildStats games={item.games} winRate={item.winRate} />
        </div>
      ))}
    </div>
  );
}

function buildStartingItemSummaries({
  analysis,
  isStartingItem,
}: {
  analysis: ChampionAnalysis;
  isStartingItem: (itemId: number, context: { setId: string; playerId: string }) => boolean;
}): CompletedItemSequenceSummary[] {
  const gamesByKey = new Map(analysis.games.map((game) => [`${game.setId}:${game.playerId}`, game]));
  const observed: Array<{ ids: number[]; result: "W" | "L" | null }> = [];

  for (const sequence of analysis.loadouts.gamePurchaseSequences) {
    const firstPurchase = sequence.purchases[0];
    if (!firstPurchase) continue;
    const context = { setId: sequence.setId, playerId: sequence.playerId };
    const ids = sequence.purchases
      .filter((purchase) => purchase.timestampMs - firstPurchase.timestampMs <= 60_000)
      .map((purchase) => purchase.itemId)
      .filter((itemId) => isStartingItem(itemId, context))
      .sort((left, right) => left - right);
    if (!ids.length) continue;
    observed.push({ ids, result: gamesByKey.get(`${sequence.setId}:${sequence.playerId}`)?.result ?? null });
  }

  const groups = new Map<string, typeof observed>();
  for (const row of observed) {
    const key = row.ids.join(",");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const wins = group.filter((row) => row.result === "W").length;
      const losses = group.filter((row) => row.result === "L").length;
      return {
        ids: group[0].ids,
        averageMinutes: group[0].ids.map(() => 0),
        games: group.length,
        eligibleGames: observed.length,
        wins,
        losses,
        winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
        selectionRate: observed.length ? (group.length / observed.length) * 100 : 0,
      };
    })
    .sort((left, right) => right.games - left.games || right.wins - left.wins);
}

function StartingItemRow({ sequence, catalogs }: { sequence: CompletedItemSequenceSummary; catalogs: ChampionCatalogs }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 flex-wrap gap-1.5">
        {sequence.ids.map((id, index) => <ItemIcon key={`${id}:${index}`} id={id} catalogs={catalogs} size="lg" />)}
      </span>
      <BuildStats games={sequence.games} winRate={sequence.winRate} />
    </div>
  );
}

const SKILL_KEY: Record<number, string> = { 1: "Q", 2: "W", 3: "E", 4: "R" };

function skillPrioritySlots(ids: number[]) {
  const rankLimit: Record<number, number> = { 1: 5, 2: 5, 3: 5 };
  const priority = [1, 2, 3].map((slot) => {
    let ranks = 0;
    let completedAt = Number.POSITIVE_INFINITY;
    ids.forEach((value, index) => {
      if (value !== slot) return;
      ranks += 1;
      if (ranks === rankLimit[slot]) completedAt = index + 1;
    });
    return { slot, ranks, completedAt, firstAt: ids.indexOf(slot) < 0 ? Number.POSITIVE_INFINITY : ids.indexOf(slot) };
  });
  return priority
    .sort((left, right) => left.completedAt - right.completedAt || right.ranks - left.ranks || left.firstAt - right.firstAt)
    .map((row) => row.slot as 1 | 2 | 3);
}

function SkillOrderCard({ order, catalogs }: { order: NumericTuplePreference | undefined; catalogs: ChampionCatalogs }) {
  return (
    <section className="min-w-0 rounded-lg bg-[var(--ui-card-bg)] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold leading-6 text-[var(--ui-ink)] sm:text-[18px]">스킬 빌드</h3>
          {order ? (
            <div className="mt-1 flex items-center">
              <span className="flex items-center gap-1">
                {skillPrioritySlots(order.ids).map((slot, index) => (
                  <span key={slot} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight aria-hidden="true" className="h-3 w-3 text-[var(--ui-muted)]" /> : null}
                    <span className="relative grid h-7 w-7 place-items-center overflow-hidden rounded-md bg-[var(--ui-surface)] text-[12px] font-medium text-[var(--ui-ink)]">
                      {catalogs.abilityIcons?.[slot] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={catalogs.abilityIcons[slot]} alt={SKILL_KEY[slot]} className="h-full w-full object-cover" />
                      ) : SKILL_KEY[slot]}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          ) : null}
        </div>
        {order ? <BuildStats games={order.games} winRate={order.winRate} /> : null}
      </div>
      {order ? (
        <SkillBuildTimeline
          abilityIcons={catalogs.abilityIcons}
          skillOrder={order.ids.slice(0, 18).map((slot, index) => ({ level: index + 1, slot: slot as 1 | 2 | 3 | 4 }))}
        />
      ) : <p className="py-3 text-[14px] font-normal text-[var(--ui-muted)]">스킬 레벨업 표본이 부족합니다.</p>}
    </section>
  );
}

function SpellList({ analysis, catalogs }: { analysis: ChampionAnalysis; catalogs: ChampionCatalogs }) {
  const combinations = analysis.loadouts.spellCombinations.slice(0, 2);
  if (!combinations.length) return <EmptyPanel title="주문 기록이 없습니다." body="선택한 범위에 주문 정보가 없습니다." />;
  return (
    <div className="grid gap-1">
      {combinations.map((combo) => (
        <div key={combo.ids.join(":")} className="flex items-center gap-2 py-1">
          <span className="flex gap-1.5">
            {combo.ids.map((id) => {
              const url = spellImageUrlById(catalogs.spells, id, catalogs.version);
              return url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={url} alt={spellLabel(catalogs.spells, id)} title={spellLabel(catalogs.spells, id)} className="h-8 w-8 rounded-md" loading="lazy" />
              ) : null;
            })}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ui-ink)]">{combo.ids.map((id) => spellLabel(catalogs.spells, id)).join(" + ")}</span>
          <BuildStats games={combo.games} winRate={combo.winRate} />
        </div>
      ))}
    </div>
  );
}

function BuildTab({ analysis, catalogs }: { analysis: ChampionAnalysis; catalogs: ChampionCatalogs }) {
  const { loadouts } = analysis;
  const topRune = loadouts.fullRunePages[0];
  const runeGrid = topRune ? buildRuneBuildGrid(topRune.names, catalogs.runeTrees) : null;
  const detailedItemMaps = new Map(
    Object.entries(catalogs.detailedItemsByVersion).map(([version, items]) => [version, new Map(items.map((item) => [item.id, item]))]),
  );
  const versionByGameKey = new Map(analysis.games.map((game) => [`${game.setId}:${game.playerId}`, ddragonVersionFromPatch(game.patch)]));
  const itemDetailForGame = (itemId: number, context: { setId: string; playerId: string }) => {
    const version = versionByGameKey.get(`${context.setId}:${context.playerId}`);
    return version ? detailedItemMaps.get(version)?.get(itemId) : undefined;
  };
  const isCoreItem = (itemId: number, context: { setId: string; playerId: string }) => {
    const detail = itemDetailForGame(itemId, context);
    return Boolean(detail && !detail.tags.includes("Boots") && !detail.tags.includes("Trinket") && isCompletedCompetitiveItem(detail));
  };
  const coreSequences = [3, 4, 5, 6].map((coreCount) => ({
    coreCount,
    sequences: buildCompletedItemSequenceSummaries({
      sequences: loadouts.gamePurchaseSequences,
      games: analysis.games,
      minItems: coreCount,
      maxItems: coreCount,
      isCompletedItem: isCoreItem,
    }),
  }));
  const threeCoreSequences = coreSequences.find(({ coreCount }) => coreCount === 3)?.sequences ?? [];
  const depthItems = [4, 5, 6].map((coreCount) => ({
    coreCount,
    items: buildDepthItemSummaries(coreSequences.find((row) => row.coreCount === coreCount)?.sequences ?? [], coreCount),
  }));
  const startingItemSequences = buildStartingItemSummaries({
    analysis,
    isStartingItem: (itemId, context) => {
      const detail = itemDetailForGame(itemId, context);
      return Boolean(detail && !detail.tags.includes("Trinket"));
    },
  });
  const runeOptions = [...catalogs.runeCatalog.keystones, ...catalogs.runeCatalog.trees];
  const fallbackRune = loadouts.runePairs[0];
  const fallbackUrls = fallbackRune ? resolveRunePairUrls(fallbackRune.ids, catalogs.runeCatalog) : null;
  const itemCatalogUnavailable = catalogs.catalogFailures.itemVersions.length > 0;
  const itemDetailById = new Map<number, DetailedGameItem>();
  for (const items of Object.values(catalogs.detailedItemsByVersion)) {
    for (const item of items) itemDetailById.set(item.id, item);
  }
  const popularBoots = [...new Map([...loadouts.finalItems, ...loadouts.roleBoundItems]
    .filter((item) => itemDetailById.get(item.id)?.tags.includes("Boots"))
    .sort((left, right) => right.games - left.games)
    .map((item) => [item.id, item])).values()]
    .slice(0, 3);
  const popularTrinkets = loadouts.trinkets.slice(0, 3);

  return (
    <section aria-labelledby="champion-build-title">
      <div className="mb-3 px-0.5">
        <h2 id="champion-build-title" className="font-paperozi text-[20px] leading-tight text-[var(--ui-ink)]">프로 빌드</h2>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex min-w-0 flex-col rounded-lg bg-[var(--ui-card-bg)] p-3 sm:p-4">
          <div className="mb-1 flex items-start justify-between gap-4">
            <h3 className="text-[16px] font-bold leading-6 text-[var(--ui-ink)] sm:text-[18px]">선호 룬</h3>
          </div>
          {catalogs.catalogFailures.runes ? <CatalogNotice>룬 이미지를 불러오지 못했습니다.</CatalogNotice> : null}
          {runeGrid ? <RuneGridView grid={runeGrid} /> : fallbackRune && fallbackUrls ? (
            <div className="flex items-center gap-4 py-5">
              <span className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {fallbackUrls.keystoneUrl ? <img src={fallbackUrls.keystoneUrl} alt="" className="h-12 w-12 rounded-full bg-black/70" /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {fallbackUrls.treeUrl ? <img src={fallbackUrls.treeUrl} alt="" className="-ml-2 h-7 w-7 rounded-full bg-black/70" /> : null}
              </span>
              <strong className="text-[15px] font-bold text-[var(--ui-ink)]">{fallbackRune.ids.map((id) => runeLabel(runeOptions, id)).join(" + ")}</strong>
            </div>
          ) : <EmptyPanel title="룬 기록이 없습니다." body="선택한 범위에 룬 정보가 없습니다." />}
        </section>

        <div className="grid min-w-0 grid-rows-[auto_1fr] gap-2">
          <section className="rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5">
            <h3 className="text-[16px] font-bold leading-6 text-[var(--ui-ink)] sm:text-[18px]">소환사 주문</h3>
            {catalogs.catalogFailures.spells ? <p className="mt-2 text-[13px] font-normal text-amber-700 dark:text-amber-300">주문 이미지를 불러오지 못했습니다.</p> : <SpellList analysis={analysis} catalogs={catalogs} />}
          </section>
          <SkillOrderCard order={loadouts.skillOrders[0]} catalogs={catalogs} />
        </div>
      </div>

      <section className="mt-3 rounded-lg bg-[var(--ui-card-bg)] p-3 sm:p-4">
        <h3 className="mb-3 text-[16px] font-bold leading-6 text-[var(--ui-ink)] sm:text-[18px]">아이템 빌드</h3>

        {itemCatalogUnavailable ? <CatalogNotice>일부 패치의 아이템 정보가 제외되었습니다.</CatalogNotice> : null}
        <div className="grid items-stretch gap-2 lg:grid-cols-2">
          <section className="h-full rounded-lg bg-[var(--ui-surface)] p-3">
            <BuildPanelTitle>시작 아이템</BuildPanelTitle>
            {startingItemSequences.length ? (
              <div className="grid gap-1">
                {startingItemSequences.slice(0, 2).map((sequence) => <StartingItemRow key={sequence.ids.join(":")} sequence={sequence} catalogs={catalogs} />)}
              </div>
            ) : <p className="py-3 text-[14px] font-normal text-[var(--ui-muted)]">시작 아이템 표본이 부족합니다.</p>}
            <div className="mt-3 grid grid-cols-2 gap-4">
              <PopularItemGroup title="선호 신발" items={popularBoots} catalogs={catalogs} />
              <PopularItemGroup title="선호 장신구" items={popularTrinkets} catalogs={catalogs} />
            </div>
          </section>

          <section className="h-full rounded-lg bg-[var(--ui-surface)] p-3">
            <BuildPanelTitle>3코어</BuildPanelTitle>
            {threeCoreSequences.length ? (
              <div className="grid gap-1">
                {threeCoreSequences.slice(0, 3).map((sequence) => <BuildSequenceRow key={sequence.ids.join(":")} sequence={sequence} catalogs={catalogs} />)}
              </div>
            ) : <p className="py-3 text-[14px] font-normal text-[var(--ui-muted)]">표본 부족</p>}
          </section>
        </div>

        <div className="mt-2 grid items-stretch gap-2 lg:grid-cols-3">
          {depthItems.map(({ coreCount, items }) => (
            <section key={coreCount} className="h-full rounded-lg bg-[var(--ui-surface)] p-3">
              <BuildPanelTitle>{coreCount}코어</BuildPanelTitle>
              <DepthItemList items={items} catalogs={catalogs} />
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}

function StatCell({ label, value, helper, className = "" }: { label: string; value: string; helper?: string; className?: string }) {
  return (
    <span aria-label={`${label} ${value}${helper ? `, ${helper}` : ""}`} className={`min-w-0 whitespace-nowrap text-right md:text-left ${className}`}>
      <strong className="text-[15px] font-bold tabular-nums text-[var(--ui-ink)]">{value}</strong>
      {helper ? <span className="ml-1 hidden text-[13px] font-normal text-[var(--ui-muted)] xl:inline">· {helper}</span> : null}
    </span>
  );
}

function MatchupsTab({ rows }: { rows: ChampionMatchup[] }) {
  return (
    <SectionCard title="상대 전적">
      {rows.length ? (
        <>
          <div className="hidden grid-cols-[minmax(11rem,1.4fr)_4.5rem_5.5rem_7rem_7rem] gap-3 whitespace-nowrap bg-[var(--ui-card-bg)] px-5 py-2.5 text-[13px] font-normal text-[var(--ui-muted)] md:grid">
            <span>상대 챔피언</span><span>경기</span><span>승률</span><span>15분 골드</span><span>15분 CS</span>
          </div>
          <div className="divide-y divide-[var(--ui-border)] px-4 sm:px-5">
            {rows.map((row) => (
              <div key={row.opponentChampionId} className="grid min-h-14 grid-cols-[minmax(0,1fr)_4.75rem] items-center gap-3 py-2.5 md:grid-cols-[minmax(11rem,1.4fr)_4.5rem_5.5rem_7rem_7rem] md:gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ChampionFace champion={row.opponentChampion} size="sm" />
                  <strong className="truncate text-[15px] font-bold text-[var(--ui-ink)]">{row.opponentChampion?.name ?? "알 수 없음"}</strong>
                  <span className="hidden lg:inline"><SampleBadge games={row.games} /></span>
                </div>
                <StatCell label="승률" value={formatPercent(row.winRate, 1)} className="md:hidden" />
                <StatCell label="경기" value={`${row.games}`} className="hidden md:block" />
                <StatCell label="승률" value={formatPercent(row.winRate, 1)} className="hidden md:block" />
                <StatCell label="15분 골드" value={formatSigned(row.metrics.goldDiffAt15.value)} helper={`${row.metrics.goldDiffAt15.recordedGames}경기`} className="hidden md:block" />
                <StatCell label="15분 CS" value={formatSigned(row.metrics.csDiffAt15.value, 1)} helper={`${row.metrics.csDiffAt15.recordedGames}경기`} className="hidden md:block" />
              </div>
            ))}
          </div>
        </>
      ) : <EmptyPanel title="상대 전적이 없습니다." body="선택한 범위에 상대 기록이 없습니다." />}
    </SectionCard>
  );
}

function DuoRow({ duo }: { duo: ChampionDuo }) {
  return (
    <details className="group">
      <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_4.75rem] items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden md:grid-cols-[minmax(11rem,1.4fr)_4.5rem_5.5rem_8rem_2rem] md:gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ChampionFace champion={duo.partnerChampion} size="sm" />
          <strong className="truncate text-[15px] font-bold text-[var(--ui-ink)]">{duo.partnerChampion?.name ?? "알 수 없음"}</strong>
          <span className="hidden lg:inline"><SampleBadge games={duo.games} /></span>
        </div>
        <StatCell label="승률" value={formatPercent(duo.winRate, 1)} className="md:hidden" />
        <StatCell label="경기" value={`${duo.games}`} className="hidden md:block" />
        <StatCell label="승률" value={formatPercent(duo.winRate, 1)} className="hidden md:block" />
        <StatCell label="15분 골드" value={formatSigned(duo.duoGoldDiffAt15.value)} helper={`${duo.duoGoldDiffAt15.recordedGames}경기`} className="hidden md:block" />
        <ChevronRight size={18} className="hidden text-[var(--ui-muted)] transition-transform group-open:rotate-90 md:block" />
      </summary>
      <div className="mb-4 grid gap-5 rounded-xl bg-[var(--ui-card-bg)] p-4 lg:grid-cols-2">
        <div>
          <h3 className="text-[18px] font-bold text-[var(--ui-ink)]">선수 조합</h3>
          <div className="mt-2 divide-y divide-[var(--ui-border)]">
            {duo.playerPairs.slice(0, 5).map((pair) => (
              <div key={`${pair.botPlayerId}:${pair.supPlayerId}`} className="flex items-center gap-3 py-2.5">
                <PlayerAvatar player={pair.botPlayer} size="sm" />
                <strong className="min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--ui-ink)]">{pair.botPlayer?.name ?? "-"} + {pair.supPlayer?.name ?? "-"}</strong>
                <span className="shrink-0 whitespace-nowrap text-right text-[13px] font-normal text-[var(--ui-muted)]"><strong className="text-[15px] font-bold text-[var(--ui-ink)]">{formatPercent(pair.winRate, 1)}</strong> · {pair.games}경기</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[var(--ui-ink)]">상대 조합</h3>
          <div className="mt-2 divide-y divide-[var(--ui-border)]">
            {duo.opponentDuos.slice(0, 5).map((opponent) => (
              <div key={`${opponent.botChampionId}:${opponent.supChampionId}`} className="flex items-center gap-3 py-2.5">
                <span className="flex shrink-0">
                  <ChampionFace champion={opponent.botChampion} size="sm" />
                  <span className="-ml-2"><ChampionFace champion={opponent.supChampion} size="sm" /></span>
                </span>
                <strong className="min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--ui-ink)]">{opponent.botChampion?.name ?? "-"} + {opponent.supChampion?.name ?? "-"}</strong>
                <span className="shrink-0 whitespace-nowrap text-right text-[13px] font-normal text-[var(--ui-muted)]"><strong className="text-[15px] font-bold text-[var(--ui-ink)]">{formatPercent(opponent.winRate, 1)}</strong> · {opponent.games}경기</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function DuosTab({ rows, position }: { rows: ChampionDuo[]; position: PlayerPosition }) {
  if (position !== "BOT" && position !== "SUP") return null;
  return (
    <SectionCard title="바텀 조합" caption="동시 출전 기준">
      {rows.length ? (
        <>
          <div className="hidden grid-cols-[minmax(11rem,1.4fr)_4.5rem_5.5rem_8rem_2rem] gap-3 whitespace-nowrap bg-[var(--ui-card-bg)] px-5 py-2.5 text-[13px] font-normal text-[var(--ui-muted)] md:grid">
            <span>파트너</span><span>경기</span><span>승률</span><span>15분 골드</span><span />
          </div>
          <div className="divide-y divide-[var(--ui-border)] px-4 sm:px-5">{rows.map((duo) => <DuoRow key={duo.partnerChampionId} duo={duo} />)}</div>
        </>
      ) : <EmptyPanel title="바텀 조합이 없습니다." body="선택한 범위에 동시 출전 기록이 없습니다." />}
    </SectionCard>
  );
}

function PlayersTab({ players }: { players: ChampionPlayerPreference[] }) {
  return (
    <SectionCard title="선수">
      {players.length ? (
        <>
          <div className="hidden grid-cols-[minmax(11rem,1.5fr)_4.5rem_5.5rem_4.5rem_7rem_7rem] gap-3 whitespace-nowrap bg-[var(--ui-card-bg)] px-5 py-2.5 text-[13px] font-normal text-[var(--ui-muted)] md:grid">
            <span>선수</span><span>경기</span><span>승률</span><span>KDA</span><span>DPM</span><span>15분 골드</span>
          </div>
          <div className="divide-y divide-[var(--ui-border)] px-4 sm:px-5">
            {players.map((row) => {
              const team = row.historicalTeams[0]?.team ?? null;
              return (
                <div key={row.playerId} className="grid min-h-14 grid-cols-[minmax(0,1fr)_4.75rem] items-center gap-3 py-2.5 md:grid-cols-[minmax(11rem,1.5fr)_4.5rem_5.5rem_4.5rem_7rem_7rem] md:gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <PlayerAvatar player={row.player} size="sm" />
                    {row.player ? <Link href={`/players/${row.player.slug}`} className="truncate text-[15px] font-bold text-[var(--ui-ink)] hover:text-[var(--accent)]">{row.player.name}</Link> : <strong className="truncate text-[15px] font-bold">알 수 없음</strong>}
                    {team ? <span className="hidden shrink-0 items-center gap-1 text-[13px] font-normal text-[var(--ui-muted)] lg:flex"><TeamLogo team={team} size="h-4 w-4" plain themeAware />{team.shortName}</span> : null}
                    <span className="hidden xl:inline"><SampleBadge games={row.games} /></span>
                  </div>
                  <StatCell label="승률" value={formatPercent(row.winRate, 1)} className="md:hidden" />
                  <StatCell label="경기" value={`${row.games}`} className="hidden md:block" />
                  <StatCell label="승률" value={formatPercent(row.winRate, 1)} className="hidden md:block" />
                  <StatCell label="KDA" value={formatNumber(row.kda, 2)} className="hidden md:block" />
                  <StatCell label="DPM" value={formatNumber(row.dpm.value)} helper={`${row.dpm.recordedGames}경기`} className="hidden md:block" />
                  <StatCell label="15분 골드" value={formatSigned(row.goldDiffAt15.value)} helper={`${row.goldDiffAt15.recordedGames}경기`} className="hidden md:block" />
                </div>
              );
            })}
          </div>
        </>
      ) : <EmptyPanel title="선수 기록이 없습니다." body="선택한 범위에 사용 기록이 없습니다." />}
    </SectionCard>
  );
}

function GamesTab({ analysis, params, basePath, page }: { analysis: ChampionAnalysis; params: URLSearchParams; basePath: string; page: number }) {
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(analysis.games.length / pageSize));
  const activePage = Math.max(1, Math.min(pageCount, page));
  const rows = analysis.games.slice((activePage - 1) * pageSize, activePage * pageSize);
  return (
    <SectionCard title="경기" caption={`${analysis.games.length.toLocaleString("ko-KR")}경기 · 최신순`}>
      {rows.length ? (
        <>
          <div className="grid h-10 grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_5.25rem] items-center gap-2 bg-[var(--ui-card-bg)] px-2.5 text-[13px] font-medium text-[var(--ui-muted)] min-[480px]:grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_6.5rem_5.25rem] min-[560px]:grid-cols-[2.25rem_10rem_3.5rem_minmax(6.5rem,1fr)_5.25rem] min-[720px]:grid-cols-[2.25rem_10.5rem_4rem_minmax(6.5rem,1fr)_auto] min-[720px]:px-3 min-[1024px]:text-[14px] min-[1280px]:hidden">
            <span className="text-center">결과</span>
            <span>선수</span>
            <span className="text-center">KDA</span>
            <span className="hidden min-[480px]:block">상대</span>
            <span className="text-center min-[720px]:text-left">아이템</span>
          </div>
          <div className="hidden h-10 grid-cols-[2.25rem_11rem_5rem_5.5rem_12rem_minmax(19rem,1fr)_1.25rem] items-center gap-2 bg-[var(--ui-card-bg)] px-2.5 text-[14px] font-medium text-[var(--ui-muted)] min-[1280px]:grid">
            <span className="text-center">결과</span>
            <span>선수</span>
            <span className="text-center">KDA</span>
            <span>대회</span>
            <span>상대</span>
            <span>아이템</span>
            <span />
          </div>
          <div className="divide-y divide-border/35">
            {rows.map((game) => {
              const tournamentLabel = compactTournamentLabel(game.tournamentName ?? game.matchName);
              const version = ddragonVersionFromPatch(game.patch);
              const itemIds = [...game.finalItemIds.slice(0, 6), ...Array<number | null>(6).fill(null)].slice(0, 6).concat(game.trinketId);
              const opponentLabel = game.opponentChampion?.name ?? "-";
              return (
                <Link
                  key={`${game.setId}:${game.playerId}`}
                  href={game.href ?? "#"}
                  aria-label={`${game.player?.name ?? "선수"} ${tournamentLabel} 경기 상세`}
                  className="group grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_5.25rem] items-center gap-2 bg-[var(--ui-surface)] px-2.5 py-2 transition-colors hover:bg-[var(--ui-surface-muted)] focus-visible:bg-[var(--ui-surface-muted)] focus-visible:outline-none min-[480px]:grid-cols-[2.25rem_minmax(0,1fr)_3.5rem_6.5rem_5.25rem] min-[560px]:grid-cols-[2.25rem_10rem_3.5rem_minmax(6.5rem,1fr)_5.25rem] min-[720px]:grid-cols-[2.25rem_10.5rem_4rem_minmax(6.5rem,1fr)_auto] min-[720px]:px-3 min-[1280px]:grid-cols-[2.25rem_11rem_5rem_5.5rem_12rem_minmax(19rem,1fr)_1.25rem] min-[1280px]:px-2.5 min-[1280px]:text-[14px]"
                >
                  <span className={`grid h-6 w-6 place-items-center justify-self-center rounded text-[12px] font-medium text-white ${game.result === "W" ? "bg-emerald-500" : "bg-rose-500"}`}>{game.result}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerAvatar player={game.player} size="sm" />
                    <span className="min-w-0">
                      <strong className="block truncate text-[14px] font-medium text-[var(--ui-ink)]">{game.player?.name ?? "-"}</strong>
                      <span className="block truncate text-[13px] font-normal text-[var(--ui-muted)]">
                        <span className="min-[1280px]:hidden">{tournamentLabel} · vs {opponentLabel}</span>
                        <span className="hidden min-[1280px]:inline">{game.team?.shortName ?? game.team?.name ?? tournamentLabel}</span>
                      </span>
                    </span>
                  </span>
                  <div className="text-center leading-tight">
                    <strong className="block whitespace-nowrap text-[13px] font-medium tabular-nums text-[var(--ui-ink)] min-[1024px]:text-[14px]">
                      {game.kills} / {game.deaths} / {game.assists}
                    </strong>
                    <span className="mt-0.5 block text-[12px] font-medium tabular-nums text-[var(--ui-muted)]">{formatNumber(game.metrics.kda.value, 2)}</span>
                  </div>
                  <span className="hidden truncate text-[13px] font-medium text-[var(--ui-muted)] min-[1280px]:block" title={game.tournamentName ?? game.matchName ?? undefined}>{tournamentLabel}</span>
                  <span className="hidden min-w-0 items-center gap-2 min-[480px]:flex">
                    <ChampionFace champion={game.opponentChampion} size="xs" />
                    <span className="truncate text-[13px] font-medium text-[var(--ui-ink)] min-[1024px]:text-[14px]">{opponentLabel}</span>
                  </span>
                  <PlayerItemSlots
                    itemIds={itemIds}
                    roleBoundItem={game.roleBoundItemId}
                    version={version}
                    compactGrid
                    className="justify-self-end min-[720px]:hidden"
                    slotClassName="h-5 w-5"
                    imageSizes="20px"
                  />
                  <PlayerItemSlots
                    itemIds={itemIds}
                    roleBoundItem={game.roleBoundItemId}
                    version={version}
                    className="hidden justify-start min-[720px]:flex min-[1280px]:!gap-0"
                    slotClassName="h-7 w-7 min-[1000px]:h-8 min-[1000px]:w-8 min-[1280px]:h-9 min-[1280px]:w-9"
                    separatorClassName="h-5 w-px min-[1000px]:h-6"
                    imageSizes="(min-width: 1280px) 36px, (min-width: 1000px) 32px, 28px"
                  />
                  <ChevronRight size={17} className="hidden text-[var(--ui-muted)] transition-transform group-hover:translate-x-0.5 min-[1280px]:block" />
                </Link>
              );
            })}
          </div>
        </>
      ) : <EmptyPanel title="경기 기록이 없습니다." body="선택한 범위에 경기 기록이 없습니다." />}
      {pageCount > 1 ? (
        <nav aria-label="경기 페이지" className="flex items-center justify-between bg-[var(--ui-card-bg)] px-4 py-3 sm:px-5">
          {activePage > 1 ? <Link href={buildHref(basePath, params, { page: activePage - 1 })} className="rounded-lg bg-[var(--ui-surface)] px-4 py-2 text-[14px] font-medium text-[var(--ui-ink)]">이전</Link> : <span />}
          <span className="text-[14px] font-normal tabular-nums text-[var(--ui-muted)]">{activePage} / {pageCount}</span>
          {activePage < pageCount ? <Link href={buildHref(basePath, params, { page: activePage + 1 })} className="rounded-lg bg-[var(--ui-surface)] px-4 py-2 text-[14px] font-medium text-[var(--ui-ink)]">다음</Link> : <span />}
        </nav>
      ) : null}
    </SectionCard>
  );
}

function DraftDistribution({ title, rows }: { title: string; rows: Array<{ key: string; count: number; rate: number }> }) {
  const labels: Record<string, string> = { blue: "블루", red: "레드", pick1: "1차 픽", pick2: "2차 픽", ban1: "1차 밴", ban2: "2차 밴" };
  return (
    <section className="rounded-lg bg-[var(--ui-card-bg)] p-4">
      <h3 className="text-[18px] font-bold text-[var(--ui-ink)]">{title}</h3>
      <div className="mt-2 divide-y divide-[var(--ui-border)]">
        {rows.slice(0, 4).map((row) => (
          <div key={row.key} className="grid min-h-11 grid-cols-[4.5rem_minmax(3rem,1fr)_7.5rem] items-center gap-3 py-2">
            <span className="text-[14px] font-medium text-[var(--ui-ink)]">{labels[row.key] ?? row.key}</span>
            <PercentageBar value={row.rate} />
            <span className="whitespace-nowrap text-right text-[13px] font-normal tabular-nums text-[var(--ui-muted)]">{row.count}회 · {formatPercent(row.rate)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsTab({ analysis }: { analysis: ChampionAnalysis }) {
  const { overview } = analysis;
  const maxPatchGames = Math.max(...overview.patches.map((item) => item.games), 1);
  const blueSide = overview.sides.find((side) => side.side === "blue");
  const redSide = overview.sides.find((side) => side.side === "red");
  const sideGames = (blueSide?.games ?? 0) + (redSide?.games ?? 0);
  const blueShare = sideGames ? ((blueSide?.games ?? 0) / sideGames) * 100 : 50;
  return (
    <div className="flex flex-col gap-7 md:gap-10">
      <SectionCard title="패치별 기록" caption={<CoverageText recorded={overview.patchCoverage.recordedGames} total={overview.patchCoverage.totalGames} />}>
        {overview.patches.length ? (
          <div className="divide-y divide-[var(--ui-border)] px-4 sm:px-5">
            {overview.patches.slice(-10).reverse().map((patch) => (
              <div key={patch.patch} className="grid min-h-12 grid-cols-[4rem_minmax(0,1fr)_4.75rem] items-center gap-3 py-2.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_8.5rem_4.75rem]">
                <strong className="text-[14px] font-medium text-[var(--ui-ink)]">{patch.patch}</strong>
                <PercentageBar value={patch.games} max={maxPatchGames} />
                <span className="hidden whitespace-nowrap text-[13px] font-normal text-[var(--ui-muted)] sm:block">{patch.wins}승 · {patch.losses}패 · {patch.games}경기</span>
                <strong className="text-right text-[15px] font-bold tabular-nums text-[var(--ui-ink)]">{formatPercent(patch.winRate, 1)}</strong>
              </div>
            ))}
          </div>
        ) : <EmptyPanel title="패치 기록이 없습니다." body="선택한 범위에 패치 정보가 없습니다." />}
      </SectionCard>

      <section>
        <h2 className="mb-3 font-paperozi text-[20px] leading-tight text-[var(--ui-ink)]">진영 · 드래프트</h2>
        <div className="grid gap-3 xl:grid-cols-[minmax(18rem,.8fr)_minmax(0,1.2fr)]">
          <section className="rounded-lg bg-[var(--ui-card-bg)] p-4">
            <h3 className="text-[18px] font-bold text-[var(--ui-ink)]">진영 승률</h3>
            <div className="mt-4 grid grid-cols-2 gap-5">
              {[blueSide, redSide].map((side) => (
                <div key={side?.side ?? "unknown"} className="min-w-0">
                  <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ui-muted)]">
                    <span className={`h-2 w-2 rounded-full ${side?.side === "blue" ? "bg-blue-500" : "bg-rose-500"}`} aria-hidden="true" />
                    {side?.side === "blue" ? "블루" : "레드"}
                  </div>
                  <strong className="mt-2 block text-[24px] font-bold tabular-nums text-[var(--ui-ink)]">{formatPercent(side?.winRate, 1)}</strong>
                  <p className="mt-1 whitespace-nowrap text-[13px] font-normal tabular-nums text-[var(--ui-muted)]">{side?.wins ?? 0}승 · {side?.losses ?? 0}패 · {side?.games ?? 0}경기</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-[var(--ui-surface)]" aria-label={`블루 ${formatPercent(blueShare)}, 레드 ${formatPercent(100 - blueShare)}`}>
              <span className="bg-blue-500" style={{ width: `${blueShare}%` }} />
              <span className="bg-rose-500" style={{ width: `${100 - blueShare}%` }} />
            </div>
          </section>
          <div className="grid gap-3 md:grid-cols-2">
            <DraftDistribution title="픽 단계" rows={overview.draftDistribution.pickPhases} />
            <DraftDistribution title="밴 단계" rows={overview.draftDistribution.banPhases} />
          </div>
        </div>
      </section>
    </div>
  );
}

export function ChampionDetail({
  champion,
  analysis,
  pickerOptions,
  activeTab,
  params,
  catalogs,
  gamePage,
  scopeControl,
}: {
  champion: Champion;
  analysis: ChampionAnalysis;
  pickerOptions: ChampionPickerOption[];
  activeTab: ChampionDetailTab;
  params: URLSearchParams;
  catalogs: ChampionCatalogs;
  gamePage: number;
  scopeControl: ReactNode;
}) {
  const basePath = `/champions/${champion.slug}`;
  const pickerParams = new URLSearchParams(params);
  pickerParams.delete("page");

  return (
    <div className="space-y-4 sm:space-y-6">
      <ChampionHeader
        champion={champion}
        analysis={analysis}
        pickerOptions={pickerOptions}
        pickerQuery={pickerParams.toString()}
        scopeControl={scopeControl}
      />

      <ChampionTabNav basePath={basePath} params={params} activeTab={activeTab} position={analysis.overview.selectedPosition} />

      {activeTab === "overview" ? <BuildTab analysis={analysis} catalogs={catalogs} /> : null}
      {activeTab === "matchups" ? <MatchupsTab rows={analysis.matchups} /> : null}
      {activeTab === "duos" ? <DuosTab rows={analysis.duos} position={analysis.overview.selectedPosition} /> : null}
      {activeTab === "pros" ? <PlayersTab players={analysis.players} /> : null}
      {activeTab === "games" ? <GamesTab analysis={analysis} params={params} basePath={basePath} page={gamePage} /> : null}
      {activeTab === "stats" ? <StatsTab analysis={analysis} /> : null}
    </div>
  );
}
