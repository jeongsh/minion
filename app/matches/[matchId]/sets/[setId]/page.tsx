import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatings,
  getMatchById,
  getPlayerStatLines,
  getSetById,
  getSetPicksBans,
  getSetsByMatchId,
  getTimelineEvents,
} from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { championImage } from "@/lib/champions";
import { ObjectiveIconSlots } from "@/components/domain/objective-icon-slots";
import {
  baronIconsForSide,
  dragonIconsForSide,
  elderIconsForSide,
  heraldIconsForSide,
  voidGrubIconsForSide,
} from "@/lib/objectives";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import {
  runeImageUrlById,
  fetchRuneCatalog,
  type RuneCatalog,
} from "@/lib/runes";
import {
  spellImageUrlById,
  fetchSpellCatalog,
  type GameSpell,
} from "@/lib/spells";
import type {
  Champion,
  DerivedPlayerStats,
  FanRating,
  Player,
  PlayerStatLine,
  SetResult,
  Team,
} from "@/lib/types";
import {
  durationLabel,
  fanRatingLeader,
  matchHref,
  playerLabel,
  setHref,
  teamLabel,
} from "@/lib/view-data";
import { isSetRatingOpen } from "@/lib/set-status";

import { submitSetPlayerRatingAction } from "../../actions";
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
    <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex justify-end">{left}</div>
      <span className="text-center text-xs font-semibold text-muted">
        {label}
      </span>
      <div>{right}</div>
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

function setKillsForTeam(set: SetResult, teamId: string) {
  if (set.blueTeamId === teamId) return set.blueKills;
  if (set.redTeamId === teamId) return set.redKills;
  return null;
}

function TeamLogoBadge({ team }: { team?: Team }) {
  if (!team) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-background/30 bg-background/10 text-xs font-bold">
        -
      </span>
    );
  }

  if (team.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 object-contain"
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full border border-background/30 bg-background/10 text-xs font-bold"
      style={{ color: team.primaryColor }}
      aria-hidden="true"
    >
      {team.shortName.slice(0, 3)}
    </span>
  );
}

function SetSummaryHeader({
  set,
  match,
  teams,
}: {
  set: SetResult;
  match: { teamAId: string; teamBId: string };
  teams: Team[];
}) {
  const teamA = teams.find((item) => item.id === match.teamAId);
  const teamB = teams.find((item) => item.id === match.teamBId);
  const teamAKills = setKillsForTeam(set, match.teamAId);
  const teamBKills = setKillsForTeam(set, match.teamBId);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-foreground px-5 py-4 text-background">
      <span className="justify-self-start text-2xl font-semibold tabular-nums">
        {durationLabel(set.durationSeconds)}
      </span>
      <div className="flex items-center gap-3">
        <TeamLogoBadge team={teamA} />
        <span className="text-2xl font-semibold tabular-nums">
          {teamAKills ?? "-"} : {teamBKills ?? "-"}
        </span>
        <TeamLogoBadge team={teamB} />
      </div>
      <span className="justify-self-end text-sm font-semibold text-background/80">
        PATCH {set.patch ?? "-"}
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
  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const champion = champions.find(
          (item) => item.id === row.line.championId,
        );
        const image = championImage(champion);
        return (
          <div
            key={`${side}-${row.player?.id ?? row.line.championId}`}
            className={`grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 ${
              side === "red" ? "grid-cols-[minmax(0,1fr)_2.25rem]" : ""
            }`}
          >
            {side === "blue" && image ? (
              <Image
                src={image}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded object-cover"
              />
            ) : null}
            <div className={`min-w-0 ${side === "red" ? "text-right" : ""}`}>
              <div
                className={`grid items-center gap-2 text-sm ${
                  side === "red"
                    ? "grid-cols-[auto_minmax(0,1fr)]"
                    : "grid-cols-[minmax(0,1fr)_auto]"
                }`}
              >
                {side === "red" ? (
                  <span className="shrink-0 tabular-nums">
                    {damageLabel(row.line.damageToChampions)}
                  </span>
                ) : null}
                <span className="truncate font-semibold">
                  {row.player?.name ?? "-"}
                </span>
                {side === "blue" ? (
                  <span className="shrink-0 tabular-nums">
                    {damageLabel(row.line.damageToChampions)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${side === "blue" ? "bg-accent" : "ml-auto bg-rose-500"}`}
                  style={{
                    width: `${Math.max(4, (row.line.damageToChampions / maxDamage) * 100)}%`,
                  }}
                />
              </div>
            </div>
            {side === "red" && image ? (
              <Image
                src={image}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded object-cover"
              />
            ) : null}
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
  rating?: { rating: number };
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
      const image = championImage(champion);
      const damageWidth = Math.max(
        4,
        (row.line.damageToChampions / maxDamage) * 100,
      );
      const accent = side === "blue" ? "bg-accent" : "bg-rose-500";
      const spell0Url = spellImageUrlById(
        spells,
        row.line.spellIds[0],
        itemVersion,
      );
      const spell1Url = spellImageUrlById(
        spells,
        row.line.spellIds[1],
        itemVersion,
      );
      const rune0Url = row.line.runeIds[0]
        ? runeImageUrlById(runeCatalog.keystones, row.line.runeIds[0])
        : "";
      const rune1Url = row.line.runeIds[1]
        ? runeImageUrlById(runeCatalog.trees, row.line.runeIds[1])
        : "";

      return (
        <div
          key={`${side}-${row.line.playerId}`}
          className="grid grid-cols-[10.25rem_7.25rem_minmax(8rem,1fr)_3.5rem_4rem_5rem_13rem] items-center gap-3 border-t border-border px-3 py-2.5 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-surface-muted">
              {image ? (
                <Image
                  src={image}
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                />
              ) : null}
              <span className="absolute bottom-0 right-0 rounded-tl bg-background/90 px-1 text-[10px] font-semibold">
                {row.line.position}
              </span>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-0.5">
              {spell0Url ? (
                <Image
                  src={spell0Url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-sm border border-border/60 bg-surface-muted object-cover"
                />
              ) : (
                <span
                  className="h-5 w-5 rounded-sm border border-dashed border-border bg-surface-muted"
                  aria-hidden="true"
                />
              )}
              {rune0Url ? (
                <Image
                  src={rune0Url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-full border border-white/10 bg-[#0d1117] object-contain"
                />
              ) : (
                <span
                  className="h-5 w-5 rounded-full border border-dashed border-border bg-surface-muted"
                  aria-hidden="true"
                />
              )}
              {spell1Url ? (
                <Image
                  src={spell1Url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-sm border border-border/60 bg-surface-muted object-cover"
                />
              ) : (
                <span
                  className="h-5 w-5 rounded-sm border border-dashed border-border bg-surface-muted"
                  aria-hidden="true"
                />
              )}
              {rune1Url ? (
                <Image
                  src={rune1Url}
                  alt=""
                  width={18}
                  height={18}
                  className="h-5 w-5 rounded-full object-contain"
                />
              ) : (
                <span
                  className="h-5 w-5 rounded-full border border-dashed border-border bg-surface-muted"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {row.player?.name ?? "-"}
              </p>
              <p className="truncate text-xs text-muted">
                {champion?.name ?? "-"}
              </p>
            </div>
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
            slotClassName="h-[22px] w-[22px]"
            separatorClassName="h-3.5 w-px"
            imageSizes="22px"
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
      <h2 id="player-stats" className="text-xl font-semibold">
        선수 스탯
      </h2>
      {blueRows.length + redRows.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted">
          선수 스탯이 아직 연결되지 않았습니다.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <div className="min-w-[58rem]">
            <div className="grid grid-cols-[10.25rem_7.25rem_minmax(8rem,1fr)_3.5rem_4rem_5rem_13rem] gap-3 px-3 py-3 text-xs font-semibold uppercase text-muted">
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

const ratingOptions = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];
const ratingPositionOrder = new Map<Player["position"], number>(
  ["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [
    position as Player["position"],
    index,
  ]),
);

function averageRatingLabel(ratings: FanRating[]) {
  if (ratings.length === 0) return "-";
  const average =
    ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
  return average.toFixed(1);
}

function FanRatingBoard({
  matchId,
  set,
  rows,
  ratings,
  players,
  teams,
}: {
  matchId: string;
  set: SetResult;
  rows: PlayerStatRow[];
  ratings: FanRating[];
  players: Player[];
  teams: Team[];
}) {
  const ratingOpen = isSetRatingOpen(set);
  const leader = fanRatingLeader(ratings);
  const orderedRows = [...rows].sort((a, b) => {
    if (a.line.teamId !== b.line.teamId) {
      return a.line.teamId === set.blueTeamId ? -1 : 1;
    }
    return (
      (ratingPositionOrder.get(a.line.position) ?? 99) -
      (ratingPositionOrder.get(b.line.position) ?? 99)
    );
  });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="set-reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="set-reviews" className="text-xl font-semibold">
            팬 평점
          </h2>
          <p className="mt-1 text-sm text-muted">
            POG는 별도 투표 없이 평균 평점이 가장 높은 선수로 집계됩니다.
          </p>
        </div>
        <span
          className={`rounded-md border px-3 py-2 text-xs font-semibold ${
            ratingOpen
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface text-muted"
          }`}
        >
          {ratingOpen ? "평점 가능" : "결과 입력 대기"}
        </span>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        {leader ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                FAN POG
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {playerLabel(players, leader.playerId)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums">
                {leader.average.toFixed(1)}
                <span className="text-base text-muted"> / 5</span>
              </p>
              <p className="mt-1 text-sm text-muted">{leader.count}개 평점</p>
            </div>
          </div>
        ) : null}

        {!ratingOpen ? (
          <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">
            세트 결과를 입력하면 평점 제출이 열립니다. 밴픽과 라인업은 먼저
            보여도 제출은 경기 종료 후에만 가능합니다.
          </div>
        ) : null}

        {orderedRows.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted">
            라인업 또는 선수 스탯을 입력하면 평점 대상 선수가 표시됩니다.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {orderedRows.map((row) => {
              const playerRatings = ratings.filter(
                (rating) => rating.playerId === row.line.playerId,
              );
              const latestReview = playerRatings.find(
                (rating) => rating.review,
              )?.review;

              return (
                <form
                  key={`${row.line.setId}-${row.line.playerId}`}
                  action={submitSetPlayerRatingAction}
                  className="rounded-md border border-border bg-background p-4"
                >
                  <input type="hidden" name="matchId" value={matchId} />
                  <input type="hidden" name="setId" value={set.id} />
                  <input type="hidden" name="playerId" value={row.line.playerId} />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted">
                        {teamLabel(teams, row.line.teamId)} · {row.line.position}
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {row.player?.name ?? "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold tabular-nums">
                        {averageRatingLabel(playerRatings)}
                      </p>
                      <p className="text-xs text-muted">
                        {playerRatings.length}개
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
                    <select
                      name="rating"
                      defaultValue=""
                      required
                      disabled={!ratingOpen}
                      className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      <option value="" disabled>
                        평점
                      </option>
                      {ratingOptions.map((value) => (
                        <option key={value} value={value}>
                          {value.toFixed(1)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="review"
                      maxLength={240}
                      disabled={!ratingOpen}
                      placeholder={latestReview ?? "짧은 리뷰"}
                      className="min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!ratingOpen}
                      className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-muted"
                    >
                      제출
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        )}
      </div>
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
    fanRatings,
    matchSets,
    timelineEvents,
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getChampions(),
    getSetPicksBans(set.id),
    getPlayerStatLines(set.id),
    getFanRatings(),
    getSetsByMatchId(match.id),
    getTimelineEvents(set.id),
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
  const relatedRatings = fanRatings.filter((rating) => rating.setId === set.id);
  const playerRows = playerStatLines.map((line) => {
    const player = players.find((item) => item.id === line.playerId);
    return {
      line,
      player,
      stats: calculatePlayerStats(line),
      rating: relatedRatings.find(
        (rating) => rating.playerId === line.playerId,
      ),
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
        <section className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-accent">세트 상세</p>
          <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
            {teamLabel(teams, set.blueTeamId)} vs{" "}
            {teamLabel(teams, set.redTeamId)} · {set.setNumber}세트
          </h1>
          <SetNavigation match={match} sets={matchSets} currentSetId={set.id} />
        </section>
      )}

      <section
        className="overflow-hidden rounded-md border border-border bg-surface"
        aria-labelledby="set-summary"
      >
        <SetSummaryHeader set={set} match={match} teams={teams} />

        <div className="grid gap-6 p-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-md border border-border bg-background">
            <div className="border-b border-border px-4 py-3 text-center text-sm font-semibold">
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

          <div className="rounded-md border border-border bg-background p-4">
            <h2 id="set-summary" className="text-center text-sm font-semibold">
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
        </div>
      </section>

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
        <h2 id="set-timeline" className="text-xl font-semibold">
          타임라인
        </h2>
        <div className="rounded-md border border-border bg-surface p-4">
          <GameTimeline
            events={timelineEvents}
            durationSeconds={set.durationSeconds}
            blueTeamId={set.blueTeamId}
            redTeamId={set.redTeamId}
            blueTeamName={teamLabel(teams, set.blueTeamId)}
            redTeamName={teamLabel(teams, set.redTeamId)}
            players={players}
          />
        </div>
      </section>

      <FanRatingBoard
        matchId={matchId}
        set={set}
        rows={playerRows}
        ratings={relatedRatings}
        players={players}
        teams={teams}
      />

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
