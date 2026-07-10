import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { TeamLogo } from "@/components/ui/team-logo";
import type { ReactNode } from "react";

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
import { championImage } from "@/lib/champions";
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
import {
  fetchSpellCatalog,
  type GameSpell,
} from "@/lib/spells";
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
    <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center border-b border-[var(--ui-border)] px-4 py-3 last:border-b-0">
      <div className="flex justify-end">{left}</div>
      <span className="text-center text-xs font-bold text-[var(--ui-muted)]">
        {label}
      </span>
      <div className="flex justify-start">{right}</div>
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

function SetSummaryHeader({
  set,
  teams,
}: {
  set: SetResult;
  teams: Team[];
}) {
  const teamA = teams.find((item) => item.id === set.blueTeamId);
  const teamB = teams.find((item) => item.id === set.redTeamId);
  const teamAKills = set.blueKills;
  const teamBKills = set.redKills;
  const decided = set.winnerTeamId != null;
  const teamAWon = decided && set.winnerTeamId === set.blueTeamId;
  const teamBWon = decided && set.winnerTeamId === set.redTeamId;
  const killClass = (won: boolean) =>
    `font-archivo text-[26px] font-black leading-none tabular-nums sm:text-[30px] ${
      !decided || won ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]"
    }`;

  return (
    <div className="relative flex items-center justify-center gap-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-4 sm:gap-6 sm:px-8">
      {/* 블루팀 */}
      <div className="flex flex-1 items-center justify-end gap-2.5 sm:gap-3">
        <span className="hidden truncate text-[15px] font-black text-[var(--ui-ink)] sm:inline">
          {teamA?.name ?? "블루"}
        </span>
        <TeamLogo team={teamA} size="h-9 w-9 sm:h-11 sm:w-11" plain />
      </div>

      {/* 중앙: 킬 스코어 + 게임 시간 */}
      <div className="flex shrink-0 flex-col items-center">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className={killClass(teamAWon)}>{teamAKills ?? "-"}</span>
          <span className="text-sm font-bold text-[var(--ui-muted)]">:</span>
          <span className={killClass(teamBWon)}>{teamBKills ?? "-"}</span>
        </div>
        <span className="mt-1.5 rounded-full bg-[var(--ui-surface)] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--ui-muted)]">
          {durationLabel(set.durationSeconds)}
        </span>
      </div>

      {/* 레드팀 */}
      <div className="flex flex-1 items-center gap-2.5 sm:gap-3">
        <TeamLogo team={teamB} size="h-9 w-9 sm:h-11 sm:w-11" plain />
        <span className="hidden truncate text-[15px] font-black text-[var(--ui-ink)] sm:inline">
          {teamB?.name ?? "레드"}
        </span>
      </div>

      {/* 우하단: 패치 버전 */}
      <span className="absolute bottom-1.5 right-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ui-muted)]">
        Patch {set.patch ?? "-"}
      </span>
    </div>
  );
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
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--ui-surface-muted)]">
      {image ? (
        <Image src={image} alt="" width={36} height={36} className="h-full w-full object-cover" />
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
  // 블루사이드/레드사이드는 LoL 관례상 색 자체가 정체성 → 타임라인 차트와 동일한 사이드 색 사용
  const barColor = side === "blue" ? "#4c8dff" : "#ff5b6e";

  return (
    <div className="grid gap-2.5">
      {rows.map((row) => {
        const champion = champions.find((item) => item.id === row.line.championId);
        const image = championImage(champion);
        const width = `${Math.max(4, (row.line.damageToChampions / maxDamage) * 100)}%`;

        const name = (
          <span className={`min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ui-ink)] ${side === "red" ? "text-right" : ""}`}>
            {row.player?.name ?? "-"}
          </span>
        );
        const value = (
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--ui-muted)]">
            {damageLabel(row.line.damageToChampions)}
          </span>
        );

        return (
          <div
            key={`${side}-${row.player?.id ?? row.line.championId}`}
            className="flex items-center gap-2.5"
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
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
                <div
                  className={`h-full rounded-full ${side === "red" ? "ml-auto" : ""}`}
                  style={{ width, backgroundColor: barColor }}
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
      const accent = side === "blue" ? "bg-blue-500" : "bg-red-500";
      return (
        <div
          key={`${side}-${row.line.playerId}`}
          className="grid grid-cols-[14rem_7.25rem_minmax(5.5rem,0.7fr)_3.5rem_4rem_5rem_13rem] items-center gap-3 border-t border-border px-3 py-2.5 text-sm"
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
        <div className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3">
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

  return (
    <section className="flex flex-col gap-4" aria-labelledby="player-stats">
      <h2 id="player-stats" className="home-section-title text-xl text-[var(--ui-ink)]">
        선수 스탯
      </h2>
      {blueRows.length + redRows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted">
          선수 스탯이 아직 연결되지 않았습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <div className="min-w-[58rem]">
            <div className="grid grid-cols-[14rem_7.25rem_minmax(5.5rem,0.7fr)_3.5rem_4rem_5rem_13rem] gap-3 px-3 py-3 text-xs font-semibold uppercase text-muted">
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
    <nav className="flex flex-wrap gap-2" aria-label="같은 매치 세트 이동">
      {sets.map((item) => {
        const active = item.id === currentSetId;
        return (
          <Link
            key={item.id}
            href={setHref(match, item)}
            aria-current={active ? "page" : undefined}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
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
          ? "flex w-full flex-col gap-6"
          : "mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10"
      }
    >
      {embedded ? null : (
        <section className="flex flex-col gap-6">
          <Breadcrumb
            items={[
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
        className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"
        aria-labelledby="set-summary"
      >
        <SetSummaryHeader set={set} teams={teams} />

        <div className="grid gap-6 p-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            <div className="border-b border-[var(--ui-border)] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ui-muted)]">
              GAME STATS
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

          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
              <h2 id="set-summary" className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ui-muted)]">
                챔피언 대상 피해량
              </h2>
              {playerRows.length === 0 ? (
                <div className="mt-4 grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-surface p-4 text-center text-sm text-muted">
                  선수 스탯이 아직 연결되지 않았습니다.
                </div>
              ) : (
                <div className="mt-4 grid gap-5 xl:grid-cols-2">
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

      <section className="flex flex-col gap-4" aria-labelledby="set-timeline">
        <h2 id="set-timeline" className="home-section-title text-xl text-[var(--ui-ink)]">
          타임라인
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
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
          />
        </div>
      </section>

      {embedded ? null : (
        <section className="flex flex-wrap gap-2" aria-label="이동">
          <Link
            href={matchHref(match)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            매치 상세
          </Link>
        </section>
      )}
    </Shell>
  );
}
