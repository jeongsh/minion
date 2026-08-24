import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { TeamLogo } from "@/components/ui/team-logo";
import { PlayerStatTable } from "@/components/domain/player-stat-table";

import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getMatchById,
  getPlayerBuildEvents,
  getPlayerStatLines,
  getSetById,
  getSetPicksBans,
  getSetsByMatchId,
  getTimelineEvents,
  getTimelineFrames,
} from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { championImage, fetchChampionAbilityIcons, normalizedDdragonId } from "@/lib/champions";
import { buildPlayerLoadoutTimeline } from "@/lib/player-build";
import {
  OBJECTIVE_ICONS,
  baronIconsForSide,
  dragonIconsForSide,
  elderIconsForSide,
  heraldIconsForSide,
  type ObjectiveIconSlot,
  voidGrubIconsForSide,
} from "@/lib/objectives";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import { buildRuneBuildGrid, fetchFullRuneTrees, fetchRuneCatalog, resolveRunePairUrls, type RuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog, type GameSpell } from "@/lib/spells";
import type {
  Champion,
  DerivedPlayerStats,
  Player,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Team,
} from "@/lib/types";
import {
  durationLabel,
  matchHref,
  setHref,
  teamLabel,
} from "@/lib/view-data";

import { GameTimeline } from "./game-timeline";
import { PlayerBuildPanel, type PlayerBuildPanelEntry } from "./player-build-panel";
import { CompactSetDraftView, SetDraftView } from "./sets/[setId]/set-draft-view";

function numberLabel(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("ko-KR");
}

function ObjectiveCountChip({
  label,
  src,
  count,
}: {
  label: string;
  src: string;
  count: number;
}) {
  const hasObjective = count > 0;
  const iconTone =
    src === OBJECTIVE_ICONS.tower
      ? hasObjective
        ? "brightness-0 opacity-70 dark:brightness-100 dark:opacity-90"
        : "brightness-0 opacity-35 dark:brightness-100 dark:opacity-45"
      : hasObjective
        ? ""
        : "grayscale opacity-45";

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center gap-1"
      aria-label={`${label} ${count}개`}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center sm:h-6 sm:w-6 wide:!h-7 wide:!w-7"
        aria-hidden="true"
      >
        <Image
          src={src}
          alt=""
          width={24}
          height={24}
          unoptimized
          title={label}
          className={`h-5 w-5 object-contain sm:h-6 sm:w-6 wide:!h-7 wide:!w-7 ${iconTone}`}
        />
      </span>
      <span
        className={`text-[13px] font-semibold leading-none tabular-nums sm:text-sm ${
          hasObjective ? "text-[var(--ui-ink)]" : "text-muted"
        }`}
        aria-hidden="true"
      >
        {count}
      </span>
    </span>
  );
}

function objectiveMetrics(set: SetResult, side: "blue" | "red") {
  return [
    {
      label: "공허 유충",
      src: OBJECTIVE_ICONS.voidGrub,
      count: voidGrubIconsForSide(set, side).length,
    },
    {
      label: "전령",
      src: OBJECTIVE_ICONS.herald,
      count: heraldIconsForSide(set, side).length,
    },
    {
      label: "바론",
      src: OBJECTIVE_ICONS.baron,
      count: baronIconsForSide(set, side).length,
    },
    {
      label: "포탑",
      src: OBJECTIVE_ICONS.tower,
      count: Math.max(0, side === "blue" ? (set.blueTowers ?? 0) : (set.redTowers ?? 0)),
    },
    {
      label: "장로",
      src: OBJECTIVE_ICONS.elder,
      count: elderIconsForSide(set, side).length,
    },
  ];
}

function DragonSlots({
  icons,
  side,
}: {
  icons: ObjectiveIconSlot[];
  side: "blue" | "red";
}) {
  const visibleIcons = icons.slice(0, 4);
  const visibleIconLabels = visibleIcons.map((icon) => icon.label).join(", ");

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-muted/70 p-0.5 sm:gap-1 sm:p-1 wide:!gap-1.5"
      aria-label={`${side === "blue" ? "블루" : "레드"} 드래곤 ${visibleIcons.length}개${visibleIconLabels ? `: ${visibleIconLabels}` : ""}`}
    >
      {Array.from({ length: 4 }, (_, index) => {
        const icon = visibleIcons[index];
        return (
          <span
            key={icon?.key ?? `${side}-empty-dragon-${index}`}
            className={`grid h-[22px] w-[22px] shrink-0 place-items-center overflow-hidden rounded-full sm:h-7 sm:w-7 wide:!h-8 wide:!w-8 ${
              icon ? "bg-surface/55" : "bg-surface text-muted"
            }`}
            title={icon?.label ?? "미획득"}
          >
            {icon ? (
              <Image
                src={icon.src}
                alt=""
                width={24}
                height={24}
                unoptimized
                className="h-5 w-5 object-contain sm:h-6 sm:w-6 wide:!h-7 wide:!w-7"
              />
            ) : (
              <span className="text-[13px] font-semibold leading-none" aria-hidden="true">
                −
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function ObjectiveTeamRail({
  set,
  side,
}: {
  set: SetResult;
  side: "blue" | "red";
}) {
  const metrics = objectiveMetrics(set, side);
  const dragonIcons = dragonIconsForSide(set, side, { includeElder: false });
  const orderedMetrics = side === "blue" ? metrics : [...metrics].reverse();
  const metricGroup = (
    <span
      className="inline-flex shrink-0 items-center gap-1 sm:gap-2 wide:!gap-2.5"
      aria-label={`${side === "blue" ? "블루" : "레드"} 일반 목표물`}
    >
      {orderedMetrics.map((metric) => (
        <ObjectiveCountChip key={metric.label} {...metric} />
      ))}
    </span>
  );
  const dragonGroup = <DragonSlots icons={dragonIcons} side={side} />;

  return (
    <div
      className={`flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-2 min-[360px]:flex-nowrap sm:gap-x-3 wide:!gap-x-4 ${
        side === "blue"
          ? "justify-end min-[1024px]:justify-self-end"
          : "justify-start min-[1024px]:justify-self-start"
      }`}
      role="group"
      aria-label={`${side === "blue" ? "블루" : "레드"} 팀 목표물`}
    >
      {side === "blue" ? metricGroup : dragonGroup}
      <span
        className="hidden h-6 w-px shrink-0 bg-border/50 min-[360px]:block wide:!h-7"
        aria-hidden="true"
      />
      {side === "blue" ? dragonGroup : metricGroup}
    </div>
  );
}

function CompactObjectiveGrid({
  set,
  side,
}: {
  set: SetResult;
  side: "blue" | "red";
}) {
  const metrics = [
    {
      label: "공허 유충",
      src: OBJECTIVE_ICONS.voidGrub,
      count: voidGrubIconsForSide(set, side).length,
    },
    {
      label: "드래곤",
      src: OBJECTIVE_ICONS.dragon,
      count: dragonIconsForSide(set, side, { includeElder: false }).length,
    },
    {
      label: "전령",
      src: OBJECTIVE_ICONS.herald,
      count: heraldIconsForSide(set, side).length,
    },
    {
      label: "바론",
      src: OBJECTIVE_ICONS.baron,
      count: baronIconsForSide(set, side).length,
    },
    {
      label: "포탑",
      src: OBJECTIVE_ICONS.tower,
      count: Math.max(0, side === "blue" ? (set.blueTowers ?? 0) : (set.redTowers ?? 0)),
    },
    {
      label: "장로",
      src: OBJECTIVE_ICONS.elder,
      count: elderIconsForSide(set, side).length,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-x-1 gap-y-2 sm:grid-cols-6 sm:gap-x-2" role="list">
      {metrics.map((metric) => {
        const hasObjective = metric.count > 0;
        return (
          <span
            key={metric.label}
            className="flex min-w-0 items-center justify-center gap-1"
            aria-label={`${metric.label} ${metric.count}개`}
            role="listitem"
          >
            <Image
              src={metric.src}
              alt=""
              width={20}
              height={20}
              unoptimized
              className={`h-5 w-5 shrink-0 object-contain ${hasObjective ? "" : "grayscale opacity-35"}`}
            />
            <span className={`text-xs font-medium tabular-nums ${hasObjective ? "text-[var(--ui-ink)]" : "text-muted"}`}>
              {metric.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function CompactScoreboard({
  set,
  champions,
  blueTeam,
  redTeam,
  blueTeamName,
  redTeamName,
  blueBans,
  redBans,
  blueKills,
  redKills,
  blueOutcome,
  redOutcome,
}: {
  set: SetResult;
  champions: Champion[];
  blueTeam?: Team;
  redTeam?: Team;
  blueTeamName: string;
  redTeamName: string;
  blueBans: SetPickBan[];
  redBans: SetPickBan[];
  blueKills: number | null;
  redKills: number | null;
  blueOutcome: ReturnType<typeof teamOutcome>;
  redOutcome: ReturnType<typeof teamOutcome>;
}) {
  const teamCell = (
    team: Team | undefined,
    name: string,
    kills: number | null,
    outcome: ReturnType<typeof teamOutcome>,
  ) => (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-[var(--ui-card-bg)] px-2.5 py-2.5 sm:gap-3 sm:px-3">
      <TeamLogo team={team} size="h-8 w-8 sm:h-10 sm:w-10" plain themeAware />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[var(--ui-ink)] sm:text-sm">{name}</p>
        <p className={`mt-0.5 text-xs font-medium ${outcome.won ? "text-accent" : "text-muted"}`}>{outcome.short}</p>
      </div>
      <strong className="text-xl font-bold tabular-nums text-[var(--ui-ink)] sm:text-2xl">{kills ?? "-"}</strong>
    </div>
  );
  const maxGold = Math.max(set.blueGold ?? 0, set.redGold ?? 0, 1);

  return (
    <div className="min-[1024px]:hidden">
      <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">
        {teamCell(blueTeam, blueTeamName, blueKills, blueOutcome)}
        {teamCell(redTeam, redTeamName, redKills, redOutcome)}
      </div>

      <div className="bg-surface-muted/20 px-2 py-3 sm:px-3">
        <CompactSetDraftView
          champions={champions}
          blue={{ teamName: blueTeamName, bans: blueBans }}
          red={{ teamName: redTeamName, bans: redBans }}
        />
      </div>

      <section className="px-2 py-3 sm:px-3" aria-label="목표물">
        <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center sm:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)]">
          <CompactObjectiveGrid set={set} side="blue" />
          <span className="text-center text-xs font-medium text-muted">목표물</span>
          <CompactObjectiveGrid set={set} side="red" />
        </div>
      </section>

      <section className="border-t border-border/50 px-2 py-3 sm:px-3" aria-label="골드">
        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="whitespace-nowrap text-xs font-medium tabular-nums text-[var(--ui-ink)] sm:text-sm">
              {numberLabel(set.blueGold)}
            </strong>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="ml-auto h-full rounded-full bg-team-blue"
                style={{ width: `${((set.blueGold ?? 0) / maxGold) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-center text-xs font-medium text-muted">골드</span>
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-team-red"
                style={{ width: `${((set.redGold ?? 0) / maxGold) * 100}%` }}
              />
            </div>
            <strong className="whitespace-nowrap text-xs font-medium tabular-nums text-[var(--ui-ink)] sm:text-sm">
              {numberLabel(set.redGold)}
            </strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function teamOutcome(winnerTeamId: string | null, teamId: string) {
  if (!winnerTeamId) {
    return { won: false, short: "미정", ko: "미정" };
  }

  const won = winnerTeamId === teamId;
  return {
    won,
    short: won ? "승리" : "패배",
    ko: won ? "승리" : "패배",
  };
}

type PlayerStatRow = {
  line: PlayerStatLine;
  player?: Player;
  stats: DerivedPlayerStats;
};

function PlayerStatBoard({
  blueRows,
  redRows,
  champions,
  maxDamage,
  teams,
  blueTeamId,
  redTeamId,
  winnerTeamId,
  itemVersion,
  spells,
  runeCatalog,
}: {
  blueRows: PlayerStatRow[];
  redRows: PlayerStatRow[];
  champions: Champion[];
  maxDamage: number;
  teams: Team[];
  blueTeamId: string;
  redTeamId: string;
  winnerTeamId: string | null;
  itemVersion: string;
  spells: GameSpell[];
  runeCatalog: RuneCatalog;
}) {
  const toTableRows = (rows: PlayerStatRow[]) =>
    rows.map((row) => {
      const champion = champions.find((item) => item.id === row.line.championId);
      return {
        id: row.line.playerId,
        champion,
        primaryLabel: row.player?.name ?? "-",
        secondaryLabel: champion?.name ?? "-",
        championLevel: row.line.championLevel,
        spellIds: row.line.spellIds,
        runeIds: row.line.runeIds,
        itemIds: row.line.itemIds,
        roleBoundItem: row.line.roleBoundItem,
        kills: row.line.kills,
        deaths: row.line.deaths,
        assists: row.line.assists,
        damage: row.line.damageToChampions,
        visionScore: row.line.visionScore,
        cs: row.line.cs,
        gold: row.line.gold,
        kda: row.stats.kda,
        dpm: row.stats.dpm,
        csm: row.stats.csm,
        version: itemVersion,
        spells,
        runeCatalog,
      };
    });

  const groups = [
    {
      id: blueTeamId,
      label: teamLabel(teams, blueTeamId),
      team: teams.find((team) => team.id === blueTeamId),
      won: winnerTeamId === blueTeamId,
      accent: "blue" as const,
      rows: toTableRows(blueRows),
    },
    {
      id: redTeamId,
      label: teamLabel(teams, redTeamId),
      team: teams.find((team) => team.id === redTeamId),
      won: winnerTeamId === redTeamId,
      accent: "red" as const,
      rows: toTableRows(redRows),
    },
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="player-stats">
      <h2 id="player-stats" className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">
        선수 스탯
      </h2>
      {blueRows.length + redRows.length === 0 ? (
        <div className="rounded-lg bg-surface p-4 text-sm text-muted shadow-sm ring-1 ring-border/60">
          선수 스탯이 아직 연결되지 않았습니다.
        </div>
      ) : (
        <PlayerStatTable groups={groups} maxDamage={maxDamage} />
      )}
    </section>
  );
}
function SetNavigation({
  match,
  sets,
  currentSetId,
}: {
  match: Parameters<typeof setHref>[0];
  sets: SetResult[];
  currentSetId: string;
}) {
  if (sets.length <= 1) return null;

  return (
    <nav className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="같은 매치 세트 이동">
      {sets.map((item) => {
        const active = item.id === currentSetId;
        return (
          <Link
            key={item.id}
            href={setHref(match, item)}
            aria-current={active ? "page" : undefined}
            className={`rounded-md border px-2 py-1 text-[13px] font-semibold sm:px-2.5 sm:py-1.5 sm:text-sm ${
              active
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            {item.setNumber}세트
          </Link>
        );
      })}
    </nav>
  );
}

export async function SetDetailContent({
  matchId,
  setId,
  embedded = false,
}: {
  matchId: string;
  setId: string;
  embedded?: boolean;
}) {
  const [match, set] = await Promise.all([
    getMatchById(matchId),
    getSetById(setId),
  ]);

  if (!match || !set || set.matchId !== match.id) {
    notFound();
  }

  const [
    teams,
    players,
    champions,
    picksBans,
    playerStatLines,
    matchSets,
    timelineEvents,
    timelineFrames,
    playerBuildEvents,
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getChampions(),
    getSetPicksBans(set.id),
    getPlayerStatLines(set.id),
    getSetsByMatchId(match.id),
    getTimelineEvents(set.id),
    getTimelineFrames(set.id),
    getPlayerBuildEvents(set.id),
  ]);

  const sideDraftItems = (side: "blue" | "red") =>
    picksBans
      .filter((item) => item.side === side && item.actionType === "ban")
      .sort((a, b) => a.orderIndex - b.orderIndex);
  const positions: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];
  const playerRows = playerStatLines.map((line) => {
    const player = players.find((item) => item.id === line.playerId);
    return {
      line,
      player,
      stats: calculatePlayerStats(line),
    };
  });
  const positionOrder = new Map<Player["position"], number>(
    positions.map((position, index) => [position, index]),
  );
  const byPosition = (a: PlayerStatRow, b: PlayerStatRow) =>
    (positionOrder.get(a.line.position) ?? 99) -
    (positionOrder.get(b.line.position) ?? 99);
  const blueRows = playerRows
    .filter((row) => row.line.teamId === set.blueTeamId)
    .sort(byPosition);
  const redRows = playerRows
    .filter((row) => row.line.teamId === set.redTeamId)
    .sort(byPosition);
  const blueTeam = teams.find((team) => team.id === set.blueTeamId);
  const redTeam = teams.find((team) => team.id === set.redTeamId);
  const blueKills =
    set.blueKills ??
    (blueRows.length === 5
      ? blueRows.reduce((sum, row) => sum + row.line.kills, 0)
      : null);
  const redKills =
    set.redKills ??
    (redRows.length === 5
      ? redRows.reduce((sum, row) => sum + row.line.kills, 0)
      : null);
  const blueOutcome = teamOutcome(set.winnerTeamId, set.blueTeamId);
  const redOutcome = teamOutcome(set.winnerTeamId, set.redTeamId);
  const maxDamage = Math.max(
    ...playerRows.map((row) => row.line.damageToChampions),
    1,
  );
  const itemVersion = ddragonVersionFromPatch(set.patch);
  const uniqueDdragonIds = [
    ...new Set(
      playerRows
        .map((row) => normalizedDdragonId(champions.find((item) => item.id === row.line.championId)))
        .filter((ddragonId) => ddragonId.length > 0),
    ),
  ];
  const [spells, runeCatalog, fullRuneTrees, abilityIconEntries] = await Promise.all([
    fetchSpellCatalog(itemVersion),
    fetchRuneCatalog(itemVersion),
    fetchFullRuneTrees(itemVersion),
    Promise.all(
      uniqueDdragonIds.map(
        async (ddragonId) => [ddragonId, await fetchChampionAbilityIcons(ddragonId, itemVersion)] as const,
      ),
    ),
  ]);
  const abilityIconsByDdragonId = new Map(abilityIconEntries);
  const playerBuildEntries: PlayerBuildPanelEntry[] = [
    ...blueRows.map((row) => ({ row, side: "blue" as const })),
    ...redRows.map((row) => ({ row, side: "red" as const })),
  ].map(({ row, side }) => {
    const champion = champions.find((item) => item.id === row.line.championId);
    const { keystoneUrl, treeUrl } = resolveRunePairUrls(row.line.runeIds, runeCatalog);
    const fullRuneNames = row.line.fullRuneNames;
    const runeGrid = fullRuneNames ? buildRuneBuildGrid(fullRuneNames, fullRuneTrees) : null;
    const { skillOrder, itemPurchaseGroups } = buildPlayerLoadoutTimeline(playerBuildEvents, row.line.playerId);
    return {
      playerId: row.line.playerId,
      playerName: row.player?.name ?? "-",
      championImageUrl: championImage(champion),
      abilityIcons: abilityIconsByDdragonId.get(normalizedDdragonId(champion)) ?? null,
      side,
      version: itemVersion,
      keystoneUrl,
      treeUrl,
      runeGrid,
      skillOrder,
      itemPurchaseGroups,
    };
  });
  const Shell = embedded ? "div" : "main";

  return (
    <Shell
      className={
        embedded
          ? "flex w-full flex-col gap-5 wide:gap-6"
          : "layout-wide flex flex-col gap-5 py-5 md:gap-6 md:py-6 xl:gap-8 xl:py-8"
      }
    >
      {embedded ? null : (
        <section className="flex flex-col gap-3 md:gap-4 lg:gap-6">
          <PageHeader
            title={`${set.setNumber}세트`}
            breadcrumbs={[
              { label: "홈", href: "/" },
              {
                label: `${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)}`,
                href: `/matches/${match.id}`,
              },
              { label: `${set.setNumber}세트` },
            ]}
          />
          <SetNavigation match={match} sets={matchSets} currentSetId={set.id} />
        </section>
      )}

      <section aria-labelledby="postgame-breakdown">
        <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
          <h2
            id="postgame-breakdown"
            className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]"
          >
            스코어보드
          </h2>
          <span className="shrink-0 pb-0.5 text-[13px] font-medium text-muted">
            {set.setNumber}세트 · {durationLabel(set.durationSeconds)}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-surface">
          <CompactScoreboard
            set={set}
            champions={champions}
            blueTeam={blueTeam}
            redTeam={redTeam}
            blueTeamName={teamLabel(teams, set.blueTeamId)}
            redTeamName={teamLabel(teams, set.redTeamId)}
            blueBans={sideDraftItems("blue")}
            redBans={sideDraftItems("red")}
            blueKills={blueKills}
            redKills={redKills}
            blueOutcome={blueOutcome}
            redOutcome={redOutcome}
          />

          <div className="hidden min-[1024px]:block">
          <div className="grid min-h-[80px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 sm:min-h-[92px] sm:gap-6 sm:px-5">
            <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-[var(--ui-ink)] sm:text-lg">
                  {teamLabel(teams, set.blueTeamId)}
                </p>
                <p className="mt-1 text-[13px] font-medium text-muted">
                  <span
                    className={blueOutcome.won ? "font-semibold text-accent" : "font-semibold"}
                  >
                    {blueOutcome.short}
                  </span>
                </p>
              </div>
              <TeamLogo
                team={blueTeam}
                size="h-11 w-11 sm:h-14 sm:w-14"
                plain
                themeAware
              />
            </div>

            <div className="text-center">
              <div className="mt-1 flex items-center justify-center gap-2 text-2xl font-bold leading-none tabular-nums text-[var(--ui-ink)] sm:text-3xl">
                <span>{blueKills ?? "-"}</span>
                <span className="text-sm font-medium text-muted sm:text-base">:</span>
                <span>{redKills ?? "-"}</span>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <TeamLogo
                team={redTeam}
                size="h-11 w-11 sm:h-14 sm:w-14"
                plain
                themeAware
              />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-[var(--ui-ink)] sm:text-lg">
                  {teamLabel(teams, set.redTeamId)}
                </p>
                <p className="mt-1 text-[13px] font-medium text-muted">
                  <span
                    className={redOutcome.won ? "font-semibold text-accent" : "font-semibold"}
                  >
                    {redOutcome.short}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface px-3 py-3 sm:px-5">
            <SetDraftView
              champions={champions}
              blue={{
                teamName: teamLabel(teams, set.blueTeamId),
                bans: sideDraftItems("blue"),
              }}
              red={{
                teamName: teamLabel(teams, set.redTeamId),
                bans: sideDraftItems("red"),
              }}
            />
          </div>

          <div className="bg-surface px-2 pb-2 sm:px-3 sm:pb-3">
            <div className="hidden grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-2 rounded-lg bg-surface px-3 py-3 min-[1024px]:grid sm:px-4 wide:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] wide:!gap-4 wide:!px-5">
              <ObjectiveTeamRail set={set} side="blue" />
              <span className="flex h-8 items-center justify-center rounded-full bg-surface-muted/60 px-3 text-[13px] font-medium text-muted">
                목표물
              </span>
              <ObjectiveTeamRail set={set} side="red" />
            </div>

          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_minmax(0,1fr)] items-center gap-3 border-t border-border/50 px-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] sm:gap-4 sm:px-5">
            <div className="grid w-full max-w-64 grid-cols-[auto_minmax(2rem,1fr)] items-center gap-3 justify-self-end">
              <span className="whitespace-nowrap text-sm font-bold tabular-nums text-[var(--ui-ink)]">
                {numberLabel(set.blueGold)}
              </span>
              <div className="flex h-1 justify-end overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-team-blue"
                  style={{
                    width: `${((set.blueGold ?? 0) / Math.max(set.blueGold ?? 0, set.redGold ?? 0, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-center text-[13px] font-medium text-muted">
              골드
            </p>
            <div className="grid w-full max-w-64 grid-cols-[minmax(2rem,1fr)_auto] items-center gap-3 justify-self-start">
              <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-team-red"
                  style={{
                    width: `${((set.redGold ?? 0) / Math.max(set.blueGold ?? 0, set.redGold ?? 0, 1)) * 100}%`,
                  }}
                />
              </div>
              <span className="whitespace-nowrap text-sm font-bold tabular-nums text-[var(--ui-ink)]">
                {numberLabel(set.redGold)}
              </span>
            </div>
          </div>
          </div>
        </div>
      </section>

      <PlayerStatBoard
        blueRows={blueRows}
        redRows={redRows}
        champions={champions}
        maxDamage={maxDamage}
        teams={teams}
        blueTeamId={set.blueTeamId}
        redTeamId={set.redTeamId}
        winnerTeamId={set.winnerTeamId}
        itemVersion={itemVersion}
        spells={spells}
        runeCatalog={runeCatalog}
      />

      <PlayerBuildPanel entries={playerBuildEntries} />

      <section className="flex flex-col gap-3" aria-labelledby="set-timeline">
        <h2 id="set-timeline" className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">
          타임라인
        </h2>
        <div className="overflow-hidden rounded-lg border border-border/60 bg-[var(--ui-surface)]">
          <GameTimeline
            events={timelineEvents}
            frames={timelineFrames}
            durationSeconds={set.durationSeconds}
            blueTeamId={set.blueTeamId}
            redTeamId={set.redTeamId}
            blueTeamName={teamLabel(teams, set.blueTeamId)}
            redTeamName={teamLabel(teams, set.redTeamId)}
            players={players}
            blueGold={set.blueGold}
            redGold={set.redGold}
            winnerTeamId={set.winnerTeamId}
          />
        </div>
      </section>

      {embedded ? null : (
        <section className="flex flex-wrap gap-2" aria-label="이동">
          <Link
            href={matchHref(match)}
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-semibold hover:bg-surface-muted"
          >
            매치 상세
          </Link>
        </section>
      )}
    </Shell>
  );
}
