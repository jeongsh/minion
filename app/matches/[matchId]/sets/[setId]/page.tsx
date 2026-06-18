import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/ui/data-table";
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
} from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { championImage } from "@/lib/champions";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import { itemImageUrl } from "@/lib/items";
import { runeImageUrlById, fetchRuneCatalog, type RuneCatalog } from "@/lib/runes";
import { spellImageUrlById, fetchSpellCatalog, type GameSpell } from "@/lib/spells";
import type { Champion, DerivedPlayerStats, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
import { durationLabel, matchHref, playerLabel, setHref, teamLabel } from "@/lib/view-data";

import { SetDraftView } from "./set-draft-view";

function goldLabel(value: number | null | undefined) {
  if (!value) return "-";
  return `${(value / 1000).toFixed(1)}K`;
}

function damageLabel(value: number | null | undefined) {
  if (!value) return "-";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString("ko-KR");
}

function numberLabel(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("ko-KR");
}

function itemImage(itemId: number, version: string) {
  return itemImageUrl(itemId, version);
}

function renderIconSlots({
  ids,
  imageFor,
  emptyLabel,
  sizeClass = "h-7 w-7",
}: {
  ids: Array<number | null>;
  imageFor: (id: number) => string;
  emptyLabel: string;
  sizeClass?: string;
}) {
  if (!ids.some((id) => id && id > 0)) {
    return <span className="text-xs font-semibold text-muted">{emptyLabel}</span>;
  }

  return ids.map((id, index) =>
    id && id > 0 ? (
      <Image
        key={`${id}-${index}`}
        src={imageFor(id)}
        alt=""
        width={28}
        height={28}
        className={`${sizeClass} rounded border border-border bg-surface-muted object-cover`}
      />
    ) : (
      <span
        key={`empty-${index}`}
        className={`${sizeClass} rounded border border-dashed border-border bg-surface-muted`}
        aria-hidden="true"
      />
    ),
  );
}

function dragonTypeItems(set: SetResult, side: "blue" | "red") {
  const prefix = side === "blue" ? "blue" : "red";
  const entries = [
    ["바람", set[`${prefix}Clouds` as keyof SetResult]],
    ["화염", set[`${prefix}Infernals` as keyof SetResult]],
    ["대지", set[`${prefix}Mountains` as keyof SetResult]],
    ["바다", set[`${prefix}Oceans` as keyof SetResult]],
    ["마공", set[`${prefix}Hextechs` as keyof SetResult]],
    ["화공", set[`${prefix}Chemtechs` as keyof SetResult]],
    ["장로", set[`${prefix}Elders` as keyof SetResult]],
  ] as const;

  return entries
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: typeof value === "number" ? value : 0 }))
    .filter((item) => item.value > 0);
}

function dragonText(set: SetResult, side: "blue" | "red") {
  const items = dragonTypeItems(set, side);
  return items.length > 0 ? items.map((item) => `${item.label} ${item.value}`).join(" / ") : "-";
}

function kdaText(rows: Array<{ line: { kills: number; deaths: number; assists: number } }>) {
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

function matchScoreForTeam(match: { teamAId: string; teamBId: string; teamAScore: number | null; teamBScore: number | null }, teamId: string) {
  if (match.teamAId === teamId) return match.teamAScore;
  if (match.teamBId === teamId) return match.teamBScore;
  return null;
}

function TeamHeader({
  teamName,
  score,
  result,
  align = "left",
}: {
  teamName: string;
  score: number | null;
  result: "WIN" | "LOSS";
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-4 bg-foreground px-5 py-4 text-background ${
        align === "right" ? "justify-end bg-accent" : ""
      }`}
    >
      {align === "left" ? <strong className="text-xl">{teamName}</strong> : null}
      <span className="text-4xl font-semibold">{score ?? "-"}</span>
      <span className="h-8 w-px bg-background/35" />
      <span className="text-xl font-semibold">{result}</span>
      {align === "right" ? <strong className="text-xl">{teamName}</strong> : null}
    </div>
  );
}

function StatRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="grid grid-cols-[1fr_7.5rem_1fr] items-center border-b border-border px-4 py-3 last:border-b-0">
      <strong className="text-right text-base">{left}</strong>
      <span className="text-center text-xs font-semibold text-muted">{label}</span>
      <strong className="text-base">{right}</strong>
    </div>
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
  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const champion = champions.find((item) => item.id === row.line.championId);
        const image = championImage(champion);
        return (
          <div
            key={`${side}-${row.player?.id ?? row.line.championId}`}
            className={`grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 ${
              side === "red" ? "grid-cols-[minmax(0,1fr)_2.25rem]" : ""
            }`}
          >
            {side === "blue" && image ? (
              <Image src={image} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" />
            ) : null}
            <div className={`min-w-0 ${side === "red" ? "text-right" : ""}`}>
              <div
                className={`grid items-center gap-2 text-sm ${
                  side === "red" ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)_auto]"
                }`}
              >
                {side === "red" ? (
                  <span className="shrink-0 tabular-nums">{damageLabel(row.line.damageToChampions)}</span>
                ) : null}
                <span className="truncate font-semibold">{row.player?.name ?? "-"}</span>
                {side === "blue" ? (
                  <span className="shrink-0 tabular-nums">{damageLabel(row.line.damageToChampions)}</span>
                ) : null}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${side === "blue" ? "bg-accent" : "ml-auto bg-rose-500"}`}
                  style={{ width: `${Math.max(4, (row.line.damageToChampions / maxDamage) * 100)}%` }}
                />
              </div>
            </div>
            {side === "red" && image ? (
              <Image src={image} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" />
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
      const champion = champions.find((item) => item.id === row.line.championId);
      const image = championImage(champion);
      const damageWidth = Math.max(4, (row.line.damageToChampions / maxDamage) * 100);
      const accent = side === "blue" ? "bg-accent" : "bg-rose-500";

      return (
        <div
          key={`${side}-${row.line.playerId}`}
          className="grid min-w-[66rem] grid-cols-[14rem_9rem_11rem_7rem_7rem_4.5rem_4rem_1fr] items-center gap-4 border-t border-border px-4 py-2.5 text-sm"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-surface-muted">
              {image ? (
                <Image src={image} alt="" width={44} height={44} className="h-full w-full object-cover" />
              ) : null}
              <span className="absolute bottom-0 right-0 rounded-tl bg-background/90 px-1 text-[10px] font-semibold">
                {row.line.position}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{teamLabel(teams, row.line.teamId)} {row.player?.name ?? "-"}</p>
              <p className="truncate text-xs text-muted">{champion?.name ?? "-"}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="font-semibold tabular-nums">
              {row.line.kills} / {row.line.deaths} / {row.line.assists}
            </p>
            <p className="text-xs font-semibold text-muted tabular-nums">{row.stats.kda.toFixed(2)}</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold tabular-nums">{numberLabel(row.line.damageToChampions)}</span>
              <span className="text-xs text-muted tabular-nums">DPM {row.stats.dpm}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div className={`h-full rounded-full ${accent}`} style={{ width: `${damageWidth}%` }} />
            </div>
          </div>

          <div className="text-center font-semibold tabular-nums">{row.line.visionScore}</div>

          <div className="text-center">
            <p className="font-semibold tabular-nums">{row.line.cs}</p>
            <p className="text-xs text-muted tabular-nums">{row.stats.csm.toFixed(1)}</p>
          </div>

          <div className="flex flex-wrap gap-1">
            {renderIconSlots({
              ids: row.line.spellIds,
              imageFor: (id) => spellImageUrlById(spells, id, itemVersion),
              emptyLabel: "-",
              sizeClass: "h-7 w-7",
            })}
          </div>

          <div className="flex items-end gap-0.5">
            {row.line.runeIds[0] ? (
              <Image
                src={runeImageUrlById(runeCatalog.keystones, row.line.runeIds[0])}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded border border-border bg-surface-muted object-cover"
              />
            ) : (
              <span className="h-8 w-8 rounded border border-dashed border-border bg-surface-muted" aria-hidden="true" />
            )}
            {row.line.runeIds[1] ? (
              <Image
                src={runeImageUrlById(runeCatalog.trees, row.line.runeIds[1])}
                alt=""
                width={22}
                height={22}
                className="h-5 w-5 rounded-sm border border-border bg-surface-muted object-cover"
              />
            ) : (
              <span className="h-5 w-5 rounded-sm border border-dashed border-border bg-surface-muted" aria-hidden="true" />
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {renderIconSlots({
              ids: row.line.itemIds,
              imageFor: (id) => itemImage(id, itemVersion),
              emptyLabel: "아이템 데이터 없음",
            })}
          </div>
        </div>
      );
    });

  const teamBlock = (teamId: string, side: "blue" | "red", rows: PlayerStatRow[]) => {
    const won = winnerTeamId === teamId;
    return (
      <div>
        <div className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <strong>{teamLabel(teams, teamId)}</strong>
            <span className={`text-xs font-semibold ${won ? "text-accent" : "text-muted"}`}>
              {won ? "Victory" : "Defeat"}
            </span>
          </div>
          <span className="text-xs font-semibold text-muted">{side === "blue" ? "Blue Side" : "Red Side"}</span>
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
          <div className="grid min-w-[58rem] grid-cols-[14rem_9rem_11rem_7rem_7rem_1fr] gap-4 px-4 py-3 text-xs font-semibold uppercase text-muted">
            <span>Champion / Player</span>
            <span className="text-center">KDA</span>
            <span>Damage</span>
            <span className="text-center">Sight</span>
            <span className="text-center">CS</span>
            <span>Items</span>
          </div>
          {teamBlock(blueTeamId, "blue", blueRows)}
          {teamBlock(redTeamId, "red", redRows)}
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

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ matchId: string; setId: string }>;
}) {
  const { matchId, setId } = await params;
  const [match, set] = await Promise.all([getMatchById(matchId), getSetById(setId)]);

  if (!match || !set || set.matchId !== match.id) {
    notFound();
  }

  const [teams, players, champions, picksBans, playerStatLines, fanRatings, matchSets] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getChampions(),
    getSetPicksBans(set.id),
    getPlayerStatLines(set.id),
    getFanRatings(),
    getSetsByMatchId(match.id),
  ]);

  const sideDraftItems = (side: "blue" | "red", actionType: "pick" | "ban") =>
    picksBans
      .filter((item) => item.side === side && item.actionType === actionType)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  const lineDraftItems = (teamId: string) =>
    positions.map((position) => {
      const statLine = playerStatLines.find((line) => line.teamId === teamId && line.position === position);
      return picksBans.find((item) => item.actionType === "pick" && item.championId === statLine?.championId) ?? null;
    });
  const playerByPosition = (teamId: string, position: Player["position"]) =>
    players.find((player) => player.teamId === teamId && player.position === position);
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
      rating: relatedRatings.find((rating) => rating.playerId === line.playerId),
    };
  });
  const positionOrder = new Map<Player["position"], number>(positions.map((position, index) => [position, index]));
  const byPosition = (a: PlayerStatRow, b: PlayerStatRow) =>
    (positionOrder.get(a.line.position) ?? 99) - (positionOrder.get(b.line.position) ?? 99);
  const blueRows = playerRows
    .filter((row) => row.line.teamId === set.blueTeamId)
    .sort(byPosition);
  const redRows = playerRows
    .filter((row) => row.line.teamId === set.redTeamId)
    .sort(byPosition);
  const blueWon = set.winnerTeamId === set.blueTeamId;
  const redWon = set.winnerTeamId === set.redTeamId;
  const maxDamage = Math.max(...playerRows.map((row) => row.line.damageToChampions), 1);
  const itemVersion = ddragonVersionFromPatch(set.patch);
  const [spells, runeCatalog] = await Promise.all([fetchSpellCatalog(itemVersion), fetchRuneCatalog(itemVersion)]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-accent">세트 상세</p>
        <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
          {teamLabel(teams, set.blueTeamId)} vs {teamLabel(teams, set.redTeamId)} · {set.setNumber}세트
        </h1>
        <SetNavigation match={match} sets={matchSets} currentSetId={set.id} />
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-surface" aria-labelledby="set-summary">
        <div className="grid bg-foreground text-background lg:grid-cols-[1fr_15rem_1fr]">
          <TeamHeader
            teamName={teamLabel(teams, set.blueTeamId)}
            score={matchScoreForTeam(match, set.blueTeamId)}
            result={blueWon ? "WIN" : "LOSS"}
          />
          <div className="grid place-items-center border-y border-background/20 px-5 py-4 text-center lg:border-x lg:border-y-0">
            <p className="text-xs font-semibold text-background/70">GAME TIME</p>
            <p className="text-3xl font-semibold">{durationLabel(set.durationSeconds)}</p>
            <p className="text-xs text-background/70">GAME {set.setNumber} · PATCH {set.patch ?? "-"}</p>
          </div>
          <TeamHeader
            teamName={teamLabel(teams, set.redTeamId)}
            score={matchScoreForTeam(match, set.redTeamId)}
            result={redWon ? "WIN" : "LOSS"}
            align="right"
          />
        </div>

        <div className="grid gap-6 p-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-md border border-border bg-background">
            <div className="border-b border-border px-4 py-3 text-center text-sm font-semibold">GAME STATS</div>
            <StatRow label="KDA" left={kdaText(blueRows)} right={kdaText(redRows)} />
            <StatRow label="GOLD" left={goldLabel(set.blueGold)} right={goldLabel(set.redGold)} />
            <StatRow label="TOWERS" left={`${set.blueTowers ?? "-"}`} right={`${set.redTowers ?? "-"}`} />
            <StatRow label="VOID GRUBS" left={`${set.blueVoidGrubs ?? "-"}`} right={`${set.redVoidGrubs ?? "-"}`} />
            <StatRow label="HERALDS" left={`${set.blueRiftHeralds ?? "-"}`} right={`${set.redRiftHeralds ?? "-"}`} />
            <StatRow label="DRAKES" left={dragonText(set, "blue")} right={dragonText(set, "red")} />
            <StatRow label="ELDERS" left={`${set.blueElders ?? "-"}`} right={`${set.redElders ?? "-"}`} />
            <StatRow label="BARONS" left={`${set.blueBarons ?? "-"}`} right={`${set.redBarons ?? "-"}`} />
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
                <DamageRows rows={blueRows} champions={champions} maxDamage={maxDamage} side="blue" />
                <DamageRows rows={redRows} champions={champions} maxDamage={maxDamage} side="red" />
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

      <section className="flex flex-col gap-4" aria-labelledby="set-reviews">
        <h2 id="set-reviews" className="text-xl font-semibold">
          세트 평점 / 리뷰
        </h2>
        <DataTable
          rows={relatedRatings}
          columns={[
            { key: "player", label: "선수", render: (row) => playerLabel(players, row.playerId) },
            { key: "rating", label: "평점", render: (row) => row.rating.toFixed(1) },
            { key: "review", label: "리뷰", render: (row) => row.review },
          ]}
        />
      </section>

      <section className="flex flex-wrap gap-2" aria-label="이동">
        <Link
          href={matchHref(match)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          매치 상세
        </Link>
      </section>
    </main>
  );
}
