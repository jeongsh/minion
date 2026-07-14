import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import type { ReactNode } from "react";
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
import { championImage, championLabel } from "@/lib/champions";
import { ObjectiveIconSlots } from "@/components/domain/objective-icon-slots";
import { PlayerLoadout } from "@/components/domain/player-loadout";
import {
  baronIconsForSide,
  dragonIconsForSide,
  elderIconsForSide,
  heraldIconsForSide,
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

function goldLabel(value: number | null | undefined) {
  if (!value) return "-";
  return `${(value / 1000).toFixed(1)}K`;
}

function damageLabel(value: number | null | undefined) {
  if (!value) return "-";
  return value >= 1000
    ? `${(value / 1000).toFixed(1)}K`
    : value.toLocaleString("ko-KR");
}

function numberLabel(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("ko-KR");
}

function StatRow({
  label,
  left,
  right,
}: {
  label: string;
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_5.75rem_1fr] items-center border-b border-[var(--ui-border)] px-2 py-1.5 last:border-b-0 sm:grid-cols-[1fr_6.5rem_1fr] sm:py-2 lg:px-3 lg:py-2.5">
      <div className="flex justify-end [&_img]:h-5 [&_img]:w-5 sm:[&_img]:h-6 sm:[&_img]:w-6">{left}</div>
      <span className="text-center text-[13px] font-bold text-[var(--ui-muted)] sm:text-sm">
        {label}
      </span>
      <div className="flex justify-start [&_img]:h-5 [&_img]:w-5 sm:[&_img]:h-6 sm:[&_img]:w-6">{right}</div>
    </div>
  );
}

function kdaText(
  rows: Array<{ line: { kills: number; deaths: number; assists: number } }>,
) {
  const totals = rows.reduce(
    (acc, row) => ({
      kills: acc.kills + row.line.kills,
      deaths: acc.deaths + row.line.deaths,
      assists: acc.assists + row.line.assists,
    }),
    { kills: 0, deaths: 0, assists: 0 },
  );
  return `${totals.kills}/${totals.deaths}/${totals.assists}`;
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ matchId: string; setId: string }>;
}) {
  const { matchId, setId } = await params;

  return <SetDetailContent matchId={matchId} setId={setId} />;
}

function ChampAvatar({ image }: { image?: string | null }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-[var(--ui-surface-muted)] sm:h-8 sm:w-8">
      {image ? (
        <Image src={image} alt="" width={32} height={32} className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

function DamageRows({
  rows,
  champions,
  maxDamage,
  side,
}: {
  rows: Array<{
    line: {
      championId?: string | null;
      damageToChampions: number;
    };
    player?: Player;
  }>;
  champions: Champion[];
  maxDamage: number;
  side: "blue" | "red";
}) {
  // 블루사이드/레드사이드는 LoL 관례상 색 자체가 정체성 → 팀 색은 클래스(bg-team-*)로 통일
  const barClass = side === "blue" ? "bg-team-blue" : "bg-team-red";

  return (
    <div className="grid gap-1.5 sm:gap-2">
      {rows.map((row) => {
        const champion = champions.find((item) => item.id === row.line.championId);
        const image = championImage(champion);
        const width = `${Math.max(4, (row.line.damageToChampions / maxDamage) * 100)}%`;

        const name = (
          <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ui-ink)] sm:text-sm ${side === "red" ? "text-right" : ""}`}>
            {row.player?.name ?? "-"}
          </span>
        );
        const value = (
          <span className="shrink-0 text-[13px] tabular-nums text-muted sm:text-sm">
            {damageLabel(row.line.damageToChampions)}
          </span>
        );

        return (
          <div
            key={`${side}-${row.player?.id ?? row.line.championId}`}
            className="flex items-center gap-2 sm:gap-2.5"
          >
            {side === "blue" ? <ChampAvatar image={image} /> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {side === "blue" ? (
                  <>{name}{value}</>
                ) : (
                  <>{value}{name}</>
                )}
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[var(--ui-surface-muted)] sm:mt-1">
                <div
                  className={`h-full rounded-full ${barClass} ${side === "red" ? "ml-auto" : ""}`}
                  style={{ width }}
                />
              </div>
            </div>
            {side === "red" ? <ChampAvatar image={image} /> : null}
          </div>
        );
      })}
    </div>
  );
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
          className="grid grid-cols-[12.5rem_6.5rem_minmax(5rem,0.7fr)_3.25rem_3.5rem_4.5rem_11.5rem] items-center gap-2.5 border-t border-border px-2.5 py-2 text-sm"
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
            <p className="text-xs font-semibold text-muted tabular-nums">
              {row.stats.kda.toFixed(2)}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold tabular-nums">
                {numberLabel(row.line.damageToChampions)}
              </span>
              <span className="text-xs text-muted tabular-nums">
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
            <p className="text-xs text-muted tabular-nums">
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
            slotClassName="h-5 w-5 min-[1200px]:h-7 min-[1200px]:w-7"
            separatorClassName="h-3.5 w-px min-[1200px]:h-4"
            imageSizes="(min-width: 1200px) 28px, 20px"
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
        <div className="flex items-center justify-between gap-2.5 bg-surface-muted px-3 py-2.5">
          <div className="flex items-center gap-2">
            <strong>{teamLabel(teams, teamId)}</strong>
            <span
              className={`text-xs font-semibold ${won ? "text-accent" : "text-muted"}`}
            >
              {won ? "Victory" : "Defeat"}
            </span>
          </div>
          <span className="text-xs font-semibold text-muted">
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
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between gap-2 bg-surface-muted px-2 py-1.5">
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
          <span className="shrink-0 text-xs font-semibold text-muted">
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
              title={`${teamLabel(teams, row.line.teamId)} ${row.player?.name ?? championLabel(champion)}`}
              subtitle={`${row.line.kills} / ${row.line.deaths} / ${row.line.assists} · ${row.stats.kda.toFixed(2)}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="player-stats">
      <h2 id="player-stats" className="home-section-title text-lg text-[var(--ui-ink)]">
        선수 스탯
      </h2>
      {blueRows.length + redRows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
          선수 스탯이 아직 연결되지 않았습니다.
        </div>
      ) : (
        <>
        <div className="grid gap-2 min-[1024px]:hidden">
          {mobileTeamBlock(blueTeamId, "blue", blueRows)}
          {mobileTeamBlock(redTeamId, "red", redRows)}
        </div>

        <div className="hidden overflow-x-auto rounded-md border border-border bg-surface min-[1024px]:block">
          <div className="min-w-[56rem]">
            <div className="grid grid-cols-[12.5rem_6.5rem_minmax(5rem,0.7fr)_3.25rem_3.5rem_4.5rem_11.5rem] gap-2.5 px-2.5 py-2.5 text-xs font-semibold uppercase text-muted">
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

  const sideDraftItems = (side: "blue" | "red", actionType: "pick" | "ban") =>
    picksBans
      .filter((item) => item.side === side && item.actionType === actionType)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  const lineDraftItems = (teamId: string) =>
    positions.map((position) => {
      const statLine = playerStatLines.find(
        (line) => line.teamId === teamId && line.position === position,
      );
      return (
        picksBans.find(
          (item) =>
            item.actionType === "pick" &&
            item.championId === statLine?.championId,
        ) ?? null
      );
    });
  const playerByPosition = (teamId: string, position: Player["position"]) =>
    players.find(
      (player) => player.teamId === teamId && player.position === position,
    );
  const positions: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];
  const blueLineup = positions.map((position) => ({
    position,
    player: playerByPosition(set.blueTeamId, position),
  }));
  const redLineup = positions.map((position) => ({
    position,
    player: playerByPosition(set.redTeamId, position),
  }));
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
          ? "flex w-full flex-col gap-5 lg:gap-6"
          : "layout-wide flex flex-col gap-4 py-4 md:gap-6 md:py-6 lg:gap-10 lg:py-10"
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

      <section
        className="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]"
        aria-labelledby="set-summary"
      >
        <div className="flex items-center gap-2 border-b border-[var(--ui-border)] px-3 py-1.5 text-[13px] font-bold text-[var(--ui-muted)] sm:py-2 sm:text-sm">
          <span>경기 시간</span>
          <span className="tabular-nums text-[var(--ui-ink)]">{durationLabel(set.durationSeconds)}</span>
        </div>

        <div className="grid items-stretch gap-2 p-2 md:gap-3 md:p-3 min-[1200px]:grid-cols-[0.9fr_1.1fr] min-[1200px]:gap-4">
          <div className="h-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            <div className="border-b border-[var(--ui-border)] px-3 py-2 lg:py-2.5">
              <h2 className="home-section-title text-center text-base text-[var(--ui-ink)]">
                게임스탯
              </h2>
            </div>
            <StatRow
              label="KDA"
              left={kdaText(blueRows)}
              right={kdaText(redRows)}
            />
            <StatRow
              label="GOLD"
              left={goldLabel(set.blueGold)}
              right={goldLabel(set.redGold)}
            />
            <StatRow
              label="TOWERS"
              left={`${set.blueTowers ?? "-"}`}
              right={`${set.redTowers ?? "-"}`}
            />
            <StatRow
              label="VOID GRUBS"
              left={<ObjectiveIconSlots icons={voidGrubIconsForSide(set, "blue")} align="right" />}
              right={<ObjectiveIconSlots icons={voidGrubIconsForSide(set, "red")} />}
            />
            <StatRow
              label="HERALDS"
              left={<ObjectiveIconSlots icons={heraldIconsForSide(set, "blue")} align="right" />}
              right={<ObjectiveIconSlots icons={heraldIconsForSide(set, "red")} />}
            />
            <StatRow
              label="DRAKES"
              left={
                <ObjectiveIconSlots
                  icons={dragonIconsForSide(set, "blue", { includeElder: false })}
                  align="right"
                />
              }
              right={
                <ObjectiveIconSlots
                  icons={dragonIconsForSide(set, "red", { includeElder: false })}
                />
              }
            />
            <StatRow
              label="ELDERS"
              left={<ObjectiveIconSlots icons={elderIconsForSide(set, "blue")} align="right" />}
              right={<ObjectiveIconSlots icons={elderIconsForSide(set, "red")} />}
            />
            <StatRow
              label="BARONS"
              left={<ObjectiveIconSlots icons={baronIconsForSide(set, "blue")} align="right" />}
              right={<ObjectiveIconSlots icons={baronIconsForSide(set, "red")} />}
            />
          </div>

          <div className="flex h-full flex-col gap-2 md:gap-3 lg:gap-4">
            <div className="flex flex-1 flex-col rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 sm:p-3">
              <h2 id="set-summary" className="home-section-title text-center text-base text-[var(--ui-ink)]">
                챔피언 대상 피해량
              </h2>
              {playerRows.length === 0 ? (
                <div className="mt-2 grid min-h-24 flex-1 place-items-center rounded-md border border-dashed border-border bg-surface p-3 text-center text-sm text-muted sm:mt-3 sm:min-h-32">
                  선수 스탯이 아직 연결되지 않았습니다.
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 md:gap-3 xl:gap-4">
                  <DamageRows
                    rows={blueRows}
                    champions={champions}
                    maxDamage={maxDamage}
                    side="blue"
                  />
                  <DamageRows
                    rows={redRows}
                    champions={champions}
                    maxDamage={maxDamage}
                    side="red"
                  />
                </div>
              )}
            </div>

            <SetDraftView
              champions={champions}
              blue={{
                teamName: teamLabel(teams, set.blueTeamId),
                bans: sideDraftItems("blue", "ban"),
                picks: sideDraftItems("blue", "pick"),
                linePicks: lineDraftItems(set.blueTeamId),
                lineup: blueLineup,
              }}
              red={{
                teamName: teamLabel(teams, set.redTeamId),
                bans: sideDraftItems("red", "ban"),
                picks: sideDraftItems("red", "pick"),
                linePicks: lineDraftItems(set.redTeamId),
                lineup: redLineup,
              }}
            />
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
        <div className="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]">
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
