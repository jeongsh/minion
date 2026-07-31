import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { TeamLogo } from "@/components/ui/team-logo";
import { ResponsivePlayerStatRow } from "@/components/domain/responsive-player-stat-row";

import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getMatchById,
  getPlayerStatLines,
  getSetById,
  getSetPicksBans,
  getSetsByMatchId,
  getTimelineEvents,
  getTimelineFrames,
} from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { championLabel } from "@/lib/champions";
import { PlayerLoadout } from "@/components/domain/player-loadout";
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
import { fetchRuneCatalog, type RuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog, type GameSpell } from "@/lib/spells";
import type {
  Champion,
  DerivedPlayerStats,
  Player,
  PlayerStatLine,
  SetResult,
  Team,
} from "@/lib/types";
import {
  durationLabel,
  matchHref,
  setHref,
  teamLabel,
} from "@/lib/view-data";

import { PlayerItemSlots } from "../../player-item-slots";
import { GameTimeline } from "../../game-timeline";
import { SetDraftView } from "./set-draft-view";

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
        className="grid h-5 w-5 shrink-0 place-items-center sm:h-6 sm:w-6 min-[1400px]:!h-7 min-[1400px]:!w-7"
        aria-hidden="true"
      >
        <Image
          src={src}
          alt=""
          width={24}
          height={24}
          unoptimized
          title={label}
          className={`h-5 w-5 object-contain sm:h-6 sm:w-6 min-[1400px]:!h-7 min-[1400px]:!w-7 ${iconTone}`}
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
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface-muted/70 p-0.5 sm:gap-1 sm:p-1 min-[1400px]:!gap-1.5"
      aria-label={`${side === "blue" ? "블루" : "레드"} 드래곤 ${visibleIcons.length}개${visibleIconLabels ? `: ${visibleIconLabels}` : ""}`}
    >
      {Array.from({ length: 4 }, (_, index) => {
        const icon = visibleIcons[index];
        return (
          <span
            key={icon?.key ?? `${side}-empty-dragon-${index}`}
            className={`grid h-[22px] w-[22px] shrink-0 place-items-center overflow-hidden rounded-full sm:h-7 sm:w-7 min-[1400px]:!h-8 min-[1400px]:!w-8 ${
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
                className="h-5 w-5 object-contain sm:h-6 sm:w-6 min-[1400px]:!h-7 min-[1400px]:!w-7"
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
      className="inline-flex shrink-0 items-center gap-1 sm:gap-2 min-[1400px]:!gap-2.5"
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
      className={`flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-2 min-[360px]:flex-nowrap sm:gap-x-3 min-[1400px]:!gap-x-4 ${
        side === "blue"
          ? "justify-end min-[1024px]:justify-self-end"
          : "justify-start min-[1024px]:justify-self-start"
      }`}
      role="group"
      aria-label={`${side === "blue" ? "블루" : "레드"} 팀 목표물`}
    >
      {side === "blue" ? metricGroup : dragonGroup}
      <span
        className="hidden h-6 w-px shrink-0 bg-border/50 min-[360px]:block min-[1400px]:!h-7"
        aria-hidden="true"
      />
      {side === "blue" ? dragonGroup : metricGroup}
    </div>
  );
}

function MobileObjectiveTeamRow({
  teamName,
  set,
  side,
}: {
  teamName: string;
  set: SetResult;
  side: "blue" | "red";
}) {
  return (
    <div
      className="relative rounded-lg bg-surface/70 px-2 py-2.5"
      aria-label={`${teamName} 목표물`}
    >
      <span
        className={`absolute inset-y-2 left-0 w-0.5 rounded-full ${
          side === "blue" ? "bg-team-blue" : "bg-team-red"
        }`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 justify-center">
        <ObjectiveTeamRail set={set} side={side} />
      </div>
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

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ matchId: string; setId: string }>;
}) {
  const { matchId, setId } = await params;

  return <SetDetailContent matchId={matchId} setId={setId} />;
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
  const renderTeamRows = (rows: PlayerStatRow[], side: "blue" | "red") =>
    rows.map((row) => {
      const champion = champions.find(
        (item) => item.id === row.line.championId,
      );
      const damageWidth = Math.max(
        4,
        (row.line.damageToChampions / maxDamage) * 100,
      );
      const accent = side === "blue" ? "bg-team-blue" : "bg-team-red";
      return (
        <div
          key={`${side}-${row.line.playerId}`}
          className="grid grid-cols-[12rem_5rem_minmax(6.5rem,1fr)_3rem_3.25rem_4.5rem_17rem] items-center gap-1.5 px-2 py-2.5 text-sm odd:bg-surface-muted/15 hover:bg-surface-muted/30"
        >
          <div>
            <PlayerLoadout
              champion={champion}
              spellIds={row.line.spellIds}
              runeIds={row.line.runeIds}
              spells={spells}
              version={itemVersion}
              runeCatalog={runeCatalog}
              primaryLabel={row.player?.name ?? "-"}
              secondaryLabel={`${champion?.name ?? "-"} · ${row.line.position}`}
              badge={`LV ${row.line.championLevel ?? "-"}`}
              size="sm"
              position={row.line.position}
            />
          </div>

          <div className="text-center">
            <p className="font-semibold tabular-nums">
              {row.line.kills} / {row.line.deaths} / {row.line.assists}
            </p>
            <p className="text-[13px] font-semibold text-muted tabular-nums">
              {row.stats.kda.toFixed(2)}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold tabular-nums">
                {numberLabel(row.line.damageToChampions)}
              </span>
              <span className="text-[13px] text-muted tabular-nums">
                DPM {row.stats.dpm}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${accent}`}
                style={{ width: `${damageWidth}%` }}
              />
            </div>
          </div>

          <div className="text-center font-semibold tabular-nums">
            {row.line.visionScore}
          </div>

          <div className="text-center">
            <p className="font-semibold tabular-nums">{row.line.cs}</p>
            <p className="text-[13px] text-muted tabular-nums">
              {row.stats.csm.toFixed(1)}
            </p>
          </div>

          <div className="text-center font-semibold tabular-nums">
            {numberLabel(row.line.gold)}
          </div>

          <PlayerItemSlots
            itemIds={row.line.itemIds}
            roleBoundItem={row.line.roleBoundItem}
            version={itemVersion}
            className="!gap-0"
            slotClassName="h-8 w-8"
            separatorClassName="h-5 w-px"
            imageSizes="32px"
          />
        </div>
      );
    });

  const teamBlock = (
    teamId: string,
    side: "blue" | "red",
    rows: PlayerStatRow[],
  ) => {
    const won = winnerTeamId === teamId;
    return (
      <div>
        <div className="flex items-center justify-between gap-2.5 bg-surface-muted/70 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <strong>{teamLabel(teams, teamId)}</strong>
            <span
              className={`text-[13px] font-semibold ${won ? "text-accent" : "text-muted"}`}
            >
              {won ? "Victory" : "Defeat"}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-muted">
            {side === "blue" ? "Blue Side" : "Red Side"}
          </span>
        </div>
        {renderTeamRows(rows, side)}
      </div>
    );
  };

  const mobileTeamBlock = (
    teamId: string,
    side: "blue" | "red",
    rows: PlayerStatRow[],
  ) => {
    const won = winnerTeamId === teamId;
    return (
      <div className="overflow-hidden rounded-lg bg-surface shadow-sm ring-1 ring-border/60">
        <div className="flex items-center justify-between gap-2 bg-surface-muted/70 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm text-[var(--ui-ink)]">
              {teamLabel(teams, teamId)}
            </strong>
            <span
              className={`text-[13px] font-semibold ${
                won ? "text-accent" : "text-muted"
              }`}
            >
              {won ? "Victory" : "Defeat"}
            </span>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-muted">
            {side === "blue" ? "Blue Side" : "Red Side"}
          </span>
        </div>

        {rows.map((row) => {
          const champion = champions.find(
            (item) => item.id === row.line.championId,
          );
          return (
            <ResponsivePlayerStatRow
              key={`${side}-mobile-${row.line.playerId}`}
              champion={champion}
              line={row.line}
              stats={row.stats}
              spells={spells}
              version={itemVersion}
              runeCatalog={runeCatalog}
              title={row.player?.name ?? championLabel(champion)}
              subtitle={`${row.line.kills} / ${row.line.deaths} / ${row.line.assists} · ${row.stats.kda.toFixed(2)}`}
              stackItemsOnSmall
              itemSlotClassName="h-6 w-6 min-[640px]:h-7 min-[640px]:w-7"
              itemSeparatorClassName="h-4 w-px min-[640px]:h-5"
              itemImageSizes="(min-width: 640px) 28px, 24px"
            />
          );
        })}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="player-stats">
      <h2 id="player-stats" className="home-section-title text-lg text-[var(--ui-ink)]">
        선수 스탯
      </h2>
      {blueRows.length + redRows.length === 0 ? (
        <div className="rounded-lg bg-surface p-4 text-sm text-muted shadow-sm ring-1 ring-border/60">
          선수 스탯이 아직 연결되지 않았습니다.
        </div>
      ) : (
        <>
          <div className="grid gap-3 min-[1024px]:hidden">
            {mobileTeamBlock(blueTeamId, "blue", blueRows)}
            {mobileTeamBlock(redTeamId, "red", redRows)}
          </div>

          <div className="hidden overflow-x-auto rounded-lg bg-surface shadow-sm ring-1 ring-border/60 min-[1024px]:block">
            <div className="min-w-[55rem]">
              <div className="grid grid-cols-[12rem_5rem_minmax(6.5rem,1fr)_3rem_3.25rem_4.5rem_17rem] gap-1.5 px-2 py-3 text-[13px] font-semibold uppercase text-muted">
                <span>Champion / Player</span>
                <span className="text-center">KDA</span>
                <span>Damage</span>
                <span className="text-center">Sight</span>
                <span className="text-center">CS</span>
                <span className="text-center">Gold</span>
                <span>Items</span>
              </div>
              {teamBlock(blueTeamId, "blue", blueRows)}
              {teamBlock(redTeamId, "red", redRows)}
            </div>
          </div>
        </>
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
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getChampions(),
    getSetPicksBans(set.id),
    getPlayerStatLines(set.id),
    getSetsByMatchId(match.id),
    getTimelineEvents(set.id),
    getTimelineFrames(set.id),
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
  const [spells, runeCatalog] = await Promise.all([
    fetchSpellCatalog(itemVersion),
    fetchRuneCatalog(itemVersion),
  ]);
  const Shell = embedded ? "div" : "main";

  return (
    <Shell
      className={
        embedded
          ? "flex w-full flex-col gap-5 min-[1280px]:gap-6"
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
            className="home-section-title text-lg text-[var(--ui-ink)]"
          >
            스코어보드
          </h2>
          <span className="pb-0.5 text-[13px] font-medium text-muted">
            {set.setNumber}세트 · {durationLabel(set.durationSeconds)}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/60 bg-surface shadow-sm">
          <div className="grid min-h-[80px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 sm:min-h-[92px] sm:gap-6 sm:px-5">
            <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-[var(--ui-ink)] sm:text-lg">
                  {teamLabel(teams, set.blueTeamId)}
                </p>
                <p className="mt-1 flex items-center justify-end gap-1 whitespace-nowrap text-[13px] font-medium text-muted">
                  <span
                    className={blueOutcome.won ? "font-semibold text-accent" : "font-semibold"}
                  >
                    {blueOutcome.short}
                  </span>
                  <span className="hidden text-muted/60 min-[480px]:inline" aria-hidden="true">
                    ·
                  </span>
                  <span className="hidden min-[480px]:inline">블루 사이드</span>
                </p>
              </div>
              <TeamLogo
                team={blueTeam}
                size="h-8 w-8 sm:h-10 sm:w-10"
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
                size="h-8 w-8 sm:h-10 sm:w-10"
                plain
                themeAware
              />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-[var(--ui-ink)] sm:text-lg">
                  {teamLabel(teams, set.redTeamId)}
                </p>
                <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-muted">
                  <span
                    className={redOutcome.won ? "font-semibold text-accent" : "font-semibold"}
                  >
                    {redOutcome.short}
                  </span>
                  <span className="hidden text-muted/60 min-[480px]:inline" aria-hidden="true">
                    ·
                  </span>
                  <span className="hidden min-[480px]:inline">레드 사이드</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-muted/20 px-3 py-3 sm:px-5">
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

          <div className="bg-surface-muted/20 px-2 pb-2 sm:px-3 sm:pb-3">
            <div className="hidden grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-2 rounded-lg bg-surface/75 px-3 py-3 min-[1024px]:grid sm:px-4 min-[1280px]:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] min-[1280px]:gap-3 min-[1400px]:!gap-4 min-[1400px]:!px-5">
              <ObjectiveTeamRail set={set} side="blue" />
              <span className="flex h-8 items-center justify-center rounded-full bg-surface-muted/60 px-3 text-[13px] font-medium text-muted">
                목표물
              </span>
              <ObjectiveTeamRail set={set} side="red" />
            </div>

            <div className="grid gap-2 min-[1024px]:hidden">
              <p className="pb-0.5 text-center text-[13px] font-medium text-muted">
                목표물
              </p>
              <MobileObjectiveTeamRow
                teamName={teamLabel(teams, set.blueTeamId)}
                set={set}
                side="blue"
              />
              <MobileObjectiveTeamRow
                teamName={teamLabel(teams, set.redTeamId)}
                set={set}
                side="red"
              />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_minmax(0,1fr)] items-center gap-3 border-t border-border/50 px-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] sm:gap-4 sm:px-5">
            <div className="grid w-full max-w-64 grid-cols-[minmax(2rem,1fr)_auto] items-center gap-3 justify-self-end">
              <div className="flex h-1 justify-end overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-team-blue"
                  style={{
                    width: `${((set.blueGold ?? 0) / Math.max(set.blueGold ?? 0, set.redGold ?? 0, 1)) * 100}%`,
                  }}
                />
              </div>
              <span className="whitespace-nowrap text-sm font-bold tabular-nums text-[var(--ui-ink)]">
                {numberLabel(set.blueGold)}
              </span>
            </div>
            <p className="text-center text-[13px] font-medium text-muted">
              골드
            </p>
            <div className="grid w-full max-w-64 grid-cols-[auto_minmax(2rem,1fr)] items-center gap-3 justify-self-start">
              <span className="whitespace-nowrap text-sm font-bold tabular-nums text-[var(--ui-ink)]">
                {numberLabel(set.redGold)}
              </span>
              <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-team-red"
                  style={{
                    width: `${((set.redGold ?? 0) / Math.max(set.blueGold ?? 0, set.redGold ?? 0, 1)) * 100}%`,
                  }}
                />
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

      <section className="flex flex-col gap-3" aria-labelledby="set-timeline">
        <h2 id="set-timeline" className="home-section-title text-lg text-[var(--ui-ink)]">
          타임라인
        </h2>
        <div className="overflow-hidden rounded-lg border border-border/60 bg-[var(--ui-surface)] shadow-sm">
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
