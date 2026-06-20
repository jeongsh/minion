import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerSocialLinks } from "@/components/domain/player-social-links";

import { MiniModalLink } from "@/components/domain/mini-modal-link";
import { SourceNotice } from "@/components/domain/source-notice";
import { DataTable } from "@/components/ui/data-table";
import { championLabel } from "@/lib/champions";
import { DEFAULT_DDRAGON_VERSION, ddragonVersionFromPatch, uniqueDdragonVersionsForPatches } from "@/lib/ddragon";
import { itemImageUrl } from "@/lib/items";
import { fetchRuneCatalog, runeImageUrlById, type RuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog, spellImageUrlById, type GameSpell } from "@/lib/spells";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatings,
  getMatches,
  getPlayerAwards,
  getPlayerBySlug,
  getPlayerCareerHistories,
  getPlayerPomCount,
  getPlayerStatLines,
  getSetPicksBans,
  getSets,
  getTeamStandings,
  getTournaments,
} from "@/lib/data/lck";
import { aggregatePlayerStatLine, calculatePlayerStats, createPlayerRadarBenchmark, type PlayerRadarBenchmark } from "@/lib/stats";
import type { FanRating, Match, Player, PlayerCareerHistory, PlayerStatLine, SetResult, Team, TeamAward, Tournament } from "@/lib/types";
import {
  filterMatchesBySegment,
  filterPicksBansByMatches,
  filterSetsByMatches,
  filterStatLinesByMatchIds,
  parseSeasonSegment,
  segmentLabel,
  type SeasonSegmentKey,
} from "@/lib/tournament-filters";
import { fanPogPlayerIdForSet, matchHref, teamLabel } from "@/lib/view-data";

const PLAYER_AWARD_META: Record<string, { label: string }> = {
  lck_finals_mvp: { label: "LCK Finals MVP" },
  worlds_mvp: { label: "Worlds MVP" },
  msi_mvp: { label: "MSI MVP" },
  all_lck_first: { label: "All-LCK 1팀" },
  all_lck_second: { label: "All-LCK 2팀" },
  rookie_of_year: { label: "신인상" },
};

const POSITIONS: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];
const PLAYER_PAGE_SEGMENTS: Array<SeasonSegmentKey | "all"> = [
  "all",
  "lck-cup",
  "lck",
  "first-stand",
  "msi",
  "ewc",
  "worlds",
  "enc",
];

function playerSegmentLabel(segment: SeasonSegmentKey | "all") {
  if (segment === "all") return "2026 전체";
  if (segment === "lck") return "2026 LCK 통합";
  return segmentLabel(segment);
}

function segmentHasPlayerData(
  segment: SeasonSegmentKey | "all",
  playerId: string,
  matches: Match[],
  tournaments: Tournament[],
  statLines: PlayerStatLine[],
  sets: SetResult[],
) {
  const segmentMatches = filterMatchesBySegment(matches, tournaments, segment);
  const segmentSetIds = new Set(filterSetsByMatches(sets, segmentMatches).map((set) => set.id));
  return statLines.some((line) => line.playerId === playerId && segmentSetIds.has(line.setId));
}

type EnrichedLine = PlayerStatLine & {
  match: Match;
  set: SetResult;
  stats: ReturnType<typeof calculatePlayerStats>;
};

type ChampionLike = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  ddragonId?: string;
};

function statValue(value: number | null | undefined, decimals = 1) {
  return value == null || Number.isNaN(value) ? "-" : value.toFixed(decimals);
}

function percentValue(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "-" : `${Math.round(value)}%`;
}

function compactDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function aggregateLines(lines: PlayerStatLine[], radarBenchmark?: PlayerRadarBenchmark) {
  const line = aggregatePlayerStatLine(lines);
  return line ? calculatePlayerStats(line, radarBenchmark) : null;
}

function enrichLines(lines: PlayerStatLine[], sets: SetResult[], matches: Match[], teamKillSourceLines: PlayerStatLine[] = lines): EnrichedLine[] {
  const setById = new Map(sets.map((set) => [set.id, set]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const teamKillsBySetTeam = new Map<string, number>();

  for (const line of teamKillSourceLines) {
    const key = `${line.setId}:${line.teamId}`;
    teamKillsBySetTeam.set(key, (teamKillsBySetTeam.get(key) ?? 0) + line.kills);
  }

  return lines.flatMap((line) => {
    const set = setById.get(line.setId);
    const match = set ? matchById.get(set.matchId) : undefined;
    if (!set || !match) return [];

    const normalizedLine = {
      ...line,
      teamKills: teamKillsBySetTeam.get(`${line.setId}:${line.teamId}`) ?? line.teamKills,
    };

    return [{ ...normalizedLine, set, match, stats: calculatePlayerStats(normalizedLine) }];
  });
}

function averageRating(ratings: FanRating[]) {
  if (ratings.length === 0) return "-";
  return (ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length).toFixed(1);
}

function matchScore(match: Match) {
  if (match.teamAScore == null || match.teamBScore == null) return match.status;
  return `${match.teamAScore}:${match.teamBScore}`;
}

function matchResultForPlayer(match: Match, teamId: string) {
  if (!match.winnerTeamId) return match.status;
  return match.winnerTeamId === teamId ? `승리 ${matchScore(match)}` : `패배 ${matchScore(match)}`;
}

function opponentId(match: Match, teamId: string) {
  return match.teamAId === teamId ? match.teamBId : match.teamAId;
}

function championImageUrl(champion: ChampionLike | undefined) {
  if (!champion) return "";
  if (champion.imageUrl) return champion.imageUrl;
  const fallback = champion.ddragonId || champion.slug || champion.name;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${fallback.replace(/[^A-Za-z0-9]/g, "")}_0.jpg`;
}

function PlayerImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  if (!src) {
    return <div className={`${className} bg-surface-muted`} aria-label={alt} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

function SectionCard({
  title,
  children,
  className = "",
  aside,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside ? <div className="text-sm text-muted">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background/45 p-4 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}

function RadarChart({
  stats,
  averageStats,
}: {
  stats: NonNullable<ReturnType<typeof aggregateLines>>;
  averageStats?: NonNullable<ReturnType<typeof aggregateLines>>;
}) {
  const axes = [
    { label: "KDA", score: stats.radarKda, raw: stats.kda, averageScore: averageStats?.radarKda, averageRaw: averageStats?.kda, decimals: 2 },
    { label: "DPM", score: stats.radarDpm, raw: stats.dpm, averageScore: averageStats?.radarDpm, averageRaw: averageStats?.dpm, decimals: 1 },
    { label: "VS", score: stats.radarVision, raw: stats.visionScoreAvg, averageScore: averageStats?.radarVision, averageRaw: averageStats?.visionScoreAvg, decimals: 2 },
    { label: "CSM", score: stats.radarCsm, raw: stats.csm, averageScore: averageStats?.radarCsm, averageRaw: averageStats?.csm, decimals: 1 },
    { label: "GD10", score: stats.radarGoldDiffAt10, raw: stats.goldDiffAt10, averageScore: averageStats?.radarGoldDiffAt10, averageRaw: averageStats?.goldDiffAt10, decimals: 1 },
    { label: "XPD10", score: stats.radarXpDiffAt10, raw: stats.xpDiffAt10, averageScore: averageStats?.radarXpDiffAt10, averageRaw: averageStats?.xpDiffAt10, decimals: 1 },
    { label: "GD15", score: stats.radarGoldDiffAt15, raw: stats.goldDiffAt15, averageScore: averageStats?.radarGoldDiffAt15, averageRaw: averageStats?.goldDiffAt15, decimals: 1 },
    { label: "XPD15", score: stats.radarXpDiffAt15, raw: stats.xpDiffAt15, averageScore: averageStats?.radarXpDiffAt15, averageRaw: averageStats?.xpDiffAt15, decimals: 1 },
  ] as const;
  const center = 110;
  const maxRadius = 76;
  const toPoints = (values: number[]) => values.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const radius = (value / 100) * maxRadius;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  });
  const playerPoints = toPoints(axes.map((axis) => axis.score));
  const averagePoints = averageStats ? toPoints(axes.map((axis) => axis.averageScore ?? 0)) : null;
  const grid = [0.25, 0.5, 0.75, 1].map((scale) =>
    axes
      .map((_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
        const radius = maxRadius * scale;
        return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
      })
      .join(" "),
  );

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_16rem] md:items-center">
      <svg viewBox="0 0 220 220" className="mx-auto h-56 w-56">
        {grid.map((polygon) => (
          <polygon key={polygon} points={polygon} className="fill-surface-muted stroke-border" />
        ))}
        {axes.map((_, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
          return (
            <line
              key={index}
              x1={center}
              y1={center}
              x2={center + Math.cos(angle) * maxRadius}
              y2={center + Math.sin(angle) * maxRadius}
              className="stroke-border"
            />
          );
        })}
        {averagePoints ? (
          <polygon points={averagePoints.join(" ")} fill="rgb(59 130 246 / 0.14)" stroke="rgb(59 130 246)" strokeWidth="2" />
        ) : null}
        <polygon points={playerPoints.join(" ")} fill="rgb(217 119 6 / 0.18)" stroke="rgb(217 119 6)" strokeWidth="2" />
        {axes.map((axis, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
          const x = center + Math.cos(angle) * (maxRadius + 24);
          const y = center + Math.sin(angle) * (maxRadius + 18);
          return (
            <text key={axis.label} x={x} y={y} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
              <tspan x={x}>{axis.label}</tspan>
              <tspan x={x} dy="12">{Math.round(axis.score)}</tspan>
            </text>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <div className="col-span-2 flex items-center gap-3 text-xs text-muted md:col-span-1">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[rgb(217,119,6)]" />이 선수</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[rgb(59,130,246)]" />동 포지션 평균</span>
        </div>
        {axes.map((axis) => (
          <div key={axis.label} className="rounded-md border border-border bg-background/45 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">{axis.label}</span>
              <strong>{Math.round(axis.score)} <span className="font-normal text-muted">({statValue(axis.raw, axis.decimals)})</span></strong>
            </div>
            {axis.averageScore != null ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                <span>동 포지션 평균</span>
                <span>{Math.round(axis.averageScore)} ({statValue(axis.averageRaw, axis.decimals)})</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-5 py-2 text-sm font-semibold ${
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-foreground hover:bg-surface-muted"
      }`}
    >
      {children}
    </Link>
  );
}

function PlayerCriteriaFilter({
  playerSlug,
  activeSegment,
  visibleSegments,
}: {
  playerSlug: string;
  activeSegment: SeasonSegmentKey | "all";
  visibleSegments: Array<SeasonSegmentKey | "all">;
}) {
  const basePath = `/players/${playerSlug}`;

  return (
    <section className="flex flex-wrap gap-2" aria-label="기준 필터">
      {visibleSegments.map((segment) => (
        <FilterLink
          key={segment}
          href={segment === "all" ? `${basePath}?segment=all` : `${basePath}?segment=${segment}`}
          active={activeSegment === segment}
        >
          {playerSegmentLabel(segment)}
        </FilterLink>
      ))}
    </section>
  );
}

function PlayerAwardHistory({ awards }: { awards: TeamAward[] }) {
  if (awards.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background/45">
      {awards.map((award, i) => {
        const meta = PLAYER_AWARD_META[award.awardType];
        return (
          <div key={award.id} className={`flex items-center gap-4 px-5 py-3.5 ${i !== 0 ? "border-t border-border" : ""}`}>
            <span className="w-10 shrink-0 text-sm font-bold tabular-nums">{award.year}</span>
            <span className="inline-flex rounded-full border border-border bg-surface-muted px-3 py-1 text-sm font-semibold">
              {meta?.label ?? award.awardType}
            </span>
            <span className="text-sm text-muted">{award.tournamentName}</span>
          </div>
        );
      })}
    </div>
  );
}

function CareerTimeline({
  histories,
  teams,
  currentTeamId,
}: {
  histories: PlayerCareerHistory[];
  teams: Team[];
  currentTeamId?: string | null;
}) {
  if (histories.length === 0) {
    return <p className="text-sm text-muted">경력 데이터가 없습니다.</p>;
  }

  const now = new Date();

  function durationLabel(startDate: string, endDate: string | null) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : now;
    const months = Math.max(
      0,
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()),
    );
    if (months < 12) return `${months}개월`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years}년 ${rem}개월` : `${years}년`;
  }

  function dateLabel(date: string | null) {
    if (!date) return "현재";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(date));
  }

  return (
    <div className="relative">
      <div className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
      <div className="flex flex-col gap-4">
        {histories.map((entry, i) => {
          const team = entry.teamId ? teams.find((t) => t.id === entry.teamId) : null;
          const teamName = team?.shortName ?? entry.teamName ?? "알 수 없음";
          const isCurrent = !entry.endDate || (entry.teamId ? entry.teamId === currentTeamId : false);

          return (
            <div key={entry.id} className="relative flex gap-4 pl-6">
              <div
                className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 ${
                  isCurrent
                    ? "border-accent bg-accent"
                    : "border-border bg-surface-muted"
                }`}
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {teamName}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">현재</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {dateLabel(entry.startDate)} – {dateLabel(entry.endDate)}
                    <span className="ml-2 text-muted/60">({durationLabel(entry.startDate, entry.endDate)})</span>
                  </p>
                  {entry.notes && <p className="mt-1 text-xs text-muted">{entry.notes}</p>}
                </div>
                <span className="shrink-0 rounded-md border border-border bg-background/45 px-2 py-0.5 text-xs font-semibold text-muted">
                  {entry.position}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function iconSlots({
  ids,
  imageFor,
  emptyText,
}: {
  ids: Array<number | null>;
  imageFor: (id: number) => string;
  emptyText: string;
}) {
  const validIds = ids.filter((id): id is number => Boolean(id && id > 0));
  if (validIds.length === 0) {
    return <span className="text-xs font-semibold text-muted">{emptyText}</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {validIds.map((id, index) => (
        <PlayerImage
          key={`${id}-${index}`}
          src={imageFor(id)}
          alt=""
          className="h-8 w-8 rounded border border-border bg-surface-muted object-cover"
        />
      ))}
    </span>
  );
}

function RecentMatchSetRows({
  player,
  teams,
  match,
  lines,
  champions,
  ratings,
  fanPog,
  officialPomName,
  spellsByVersion,
  runeCatalogByVersion,
}: {
  player: Player;
  teams: Team[];
  match: Match;
  lines: EnrichedLine[];
  champions: ChampionLike[];
  ratings: FanRating[];
  fanPog: boolean;
  officialPomName: string;
  spellsByVersion: Record<string, GameSpell[]>;
  runeCatalogByVersion: Record<string, RuneCatalog>;
}) {
  const opponent = teamLabel(teams, opponentId(match, player.teamId));
  const matchRating = averageRating(ratings);

  return (
    <article className="overflow-hidden rounded-md border border-border bg-background/30">
      <div className="grid gap-3 border-b border-border bg-surface-muted px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto_auto] md:items-center">
        <div>
          <p className="font-semibold">{compactDate(match.matchDate)} · vs {opponent}</p>
          <p className="mt-1 text-xs text-muted">{match.name}</p>
        </div>
        <div><span className="text-muted">매치 결과 </span><strong>{matchResultForPlayer(match, player.teamId)}</strong></div>
        <div><span className="text-muted">매치 평점 </span><strong>{matchRating}</strong></div>
        <div><span className="text-muted">팬 POG </span><strong>{fanPog ? "선정" : "-"}</strong></div>
        <div><span className="text-muted">공식 POM </span><strong>{officialPomName}</strong></div>
      </div>

      <div className="divide-y divide-border">
        {lines.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted">이 매치에 연결된 선수 세트 기록이 없습니다.</div>
        ) : (
          lines.map((line) => {
            const champion = champions.find((item) => item.id === line.championId);
            const rating = ratings.find((item) => item.setId === line.setId);
            const itemVersion = ddragonVersionFromPatch(line.set.patch);
            const spells = spellsByVersion[itemVersion] ?? spellsByVersion[DEFAULT_DDRAGON_VERSION] ?? [];
            const runeCatalog = runeCatalogByVersion[itemVersion] ?? runeCatalogByVersion[DEFAULT_DDRAGON_VERSION] ?? {
              keystones: [],
              trees: [],
            };
            return (
              <div
                key={line.setId}
                className="grid min-w-[56rem] grid-cols-[8rem_5.5rem_7rem_4rem_4.5rem_6rem_6rem_minmax(14rem,1fr)] items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative h-12 w-12 shrink-0">
                    <PlayerImage src={championImageUrl(champion)} alt="" className="h-12 w-12 rounded object-cover" />
                    <span className="absolute bottom-0 left-0 rounded-tr bg-background/90 px-1 text-[10px] font-semibold">
                      {line.set.setNumber}세트
                    </span>
                  </div>
                  <p className="min-w-0 truncate font-semibold">{champion ? championLabel(champion) : "-"}</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.kills} / {line.deaths} / {line.assists}</p>
                  <p className="text-xs text-muted">{line.stats.kda.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.damageToChampions.toLocaleString("ko-KR")}</p>
                  <p className="text-xs text-muted">DPM {line.stats.dpm}</p>
                </div>
                <div className="text-center font-semibold tabular-nums">{line.visionScore}</div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.cs}</p>
                  <p className="text-xs text-muted">{line.stats.csm}</p>
                </div>
                <div>
                  {iconSlots({
                    ids: line.spellIds,
                    imageFor: (id) => spellImageUrlById(spells, id, itemVersion),
                    emptyText: "스펠 없음",
                  })}
                </div>
                <div className="flex flex-col gap-0.5">
                  {(() => {
                    const keystoneUrl = line.runeIds[0] ? runeImageUrlById(runeCatalog.keystones, line.runeIds[0]) : "";
                    const treeUrl = line.runeIds[1] ? runeImageUrlById(runeCatalog.trees, line.runeIds[1]) : "";
                    if (!keystoneUrl && !treeUrl) return <span className="text-xs font-semibold text-muted">룬 없음</span>;
                    return (
                      <div className="flex items-center gap-1">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10" style={{ background: "#0d1117" }}>
                          {keystoneUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={keystoneUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                          )}
                        </div>
                        {treeUrl && (
                          <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={treeUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex flex-wrap items-center gap-1">
                    {(() => {
                      const regularItems = line.itemIds.slice(0, 6).filter((id): id is number => Boolean(id && id > 0));
                      const hasSomething = regularItems.length > 0 || line.roleBoundItem || line.itemIds[6];
                      if (!hasSomething) return <span className="text-xs font-semibold text-muted">아이템 데이터 없음</span>;
                      return (
                        <>
                          {regularItems.map((id, i) => (
                            <PlayerImage key={`it${i}`} src={itemImageUrl(id, itemVersion)} alt="" className="h-8 w-8 rounded border border-border bg-surface-muted object-cover" />
                          ))}
                          {line.roleBoundItem ? (
                            <>
                              <span className="h-5 w-px bg-border/50" />
                              <PlayerImage src={itemImageUrl(line.roleBoundItem, itemVersion)} alt="" className="h-8 w-8 rounded border border-border bg-surface-muted object-cover" />
                            </>
                          ) : null}
                          {line.itemIds[6] ? (
                            <>
                              <span className="h-5 w-px bg-border/50" />
                              <PlayerImage src={itemImageUrl(line.itemIds[6], itemVersion)} alt="" className="h-8 w-8 rounded border border-border bg-surface-muted object-cover" />
                            </>
                          ) : null}
                        </>
                      );
                    })()}
                  </span>
                  <span className="shrink-0 text-xs text-muted">평점 {rating ? rating.rating.toFixed(1) : "-"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerSlug: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  const [{ playerSlug }, query] = await Promise.all([params, searchParams]);
  const player = await getPlayerBySlug(playerSlug);

  if (!player) {
    notFound();
  }

  const [
    teams,
    players,
    matches,
    sets,
    statLines,
    fanRatings,
    awards,
    pomCount,
    tournaments,
    champions,
    picksBans,
    standings,
    careerHistories,
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getMatches(),
    getSets(),
    getPlayerStatLines(),
    getFanRatings(),
    getPlayerAwards(player.name, player.id),
    getPlayerPomCount(player.id),
    getTournaments(),
    getChampions(),
    getSetPicksBans(),
    getTeamStandings(),
    getPlayerCareerHistories([player.id]),
  ]);

  const visibleSegments = PLAYER_PAGE_SEGMENTS.filter((segment) =>
    segmentHasPlayerData(segment, player.id, matches, tournaments, statLines, sets),
  );
  const requestedSegment = query.segment == null ? "all" : parseSeasonSegment(query.segment);
  const activeSegment = visibleSegments.includes(requestedSegment)
    ? requestedSegment
    : (visibleSegments[0] ?? "all");
  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);
  const segmentSets = filterSetsByMatches(sets, segmentMatches);
  const scopedLines = filterStatLinesByMatchIds(statLines, sets, segmentMatches);
  const scopedPicksBans = filterPicksBansByMatches(picksBans, sets, segmentMatches);
  const playerLines = enrichLines(scopedLines.filter((line) => line.playerId === player.id), segmentSets, segmentMatches, scopedLines);
  const radarBenchmark = createPlayerRadarBenchmark(scopedLines.filter((line) => line.position === player.position));
  const aggregateStats = aggregateLines(playerLines, radarBenchmark);
  const playerTeam = teams.find((team) => team.id === player.teamId);
  const sameTeamPlayers = players
    .filter((item) => item.teamId === player.teamId && item.id !== player.id)
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position));
  const teamStanding = standings.find((standing) => standing.teamId === player.teamId);
  const teamRecent = segmentMatches
    .filter((match) => match.teamAId === player.teamId || match.teamBId === player.teamId)
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 5)
    .map((match) => (match.winnerTeamId === player.teamId ? "W" : "L"))
    .join("-");
  const playerRatings = fanRatings.filter((rating) => playerLines.some((line) => line.setId === rating.setId) && rating.playerId === player.id);
  const playerFanPogSetIds = new Set(
    playerLines
      .filter((line) => fanPogPlayerIdForSet(line.setId, fanRatings) === player.id)
      .map((line) => line.setId),
  );
  const completedPlayerMatches = [...new Map(playerLines.map((line) => [line.match.id, line.match])).values()]
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const recentMatchIds = new Set(completedPlayerMatches.slice(0, 3).map((match) => match.id));
  const recentStats = aggregateLines(playerLines.filter((line) => recentMatchIds.has(line.match.id)), radarBenchmark);

  const championRows = [...new Set(playerLines.map((line) => line.championId).filter(Boolean) as string[])]
    .map((championId) => {
      const champion = champions.find((item) => item.id === championId);
      const lines = playerLines.filter((line) => line.championId === championId);
      const stats = aggregateLines(lines);
      const wins = lines.filter((line) => line.set.winnerTeamId === player.teamId).length;
      const championRatings = fanRatings.filter((rating) => rating.playerId === player.id && lines.some((line) => line.setId === rating.setId));
      const championPogCount = lines.filter((line) => playerFanPogSetIds.has(line.setId)).length;
      const pickCount = scopedPicksBans.filter((item) => item.championId === championId && item.actionType === "pick").length;
      const banCount = scopedPicksBans.filter((item) => item.championId === championId && item.actionType === "ban").length;
      const mainUsers =
        [...new Set(scopedLines.filter((line) => line.championId === championId).map((line) => line.playerId))]
          .map((id) => players.find((item) => item.id === id)?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ") || "-";

      return {
        champion,
        lines,
        stats,
        wins,
        winRate: lines.length === 0 ? null : (wins / lines.length) * 100,
        avgRating: averageRating(championRatings),
        fanPogCount: championPogCount,
        recentDate: lines.sort((a, b) => new Date(b.match.matchDate).getTime() - new Date(a.match.matchDate).getTime())[0]?.match.matchDate,
        pickCount,
        banCount,
        pickBanRate: segmentSets.length === 0 ? null : ((pickCount + banCount) / segmentSets.length) * 100,
        mainUsers,
      };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  const recentMatchRows = completedPlayerMatches.slice(0, 10).map((match) => {
    const lines = playerLines
      .filter((line) => line.match.id === match.id)
      .sort((a, b) => a.set.setNumber - b.set.setNumber);
    const matchRatings = fanRatings.filter((rating) => rating.matchId === match.id && rating.playerId === player.id);
    const matchPogCount = lines.filter((line) => playerFanPogSetIds.has(line.setId)).length;
    const officialPomName = players.find((item) => item.id === match.officialPomPlayerId)?.name ?? "-";

    return {
      match,
      lines,
      ratings: matchRatings,
      fanPog: matchPogCount > 0,
      officialPomName,
    };
  });

  const wins = playerLines.filter((line) => line.set.winnerTeamId === player.teamId).length;
  const losses = Math.max(playerLines.length - wins, 0);
  const featuredMatch = recentMatchRows[0];
  const playerKdaLine =
    playerLines.length === 0
      ? "-"
      : `${playerLines.reduce((sum, line) => sum + line.kills, 0)} / ${playerLines.reduce((sum, line) => sum + line.deaths, 0)} / ${playerLines.reduce((sum, line) => sum + line.assists, 0)}`;
  const teammates = sameTeamPlayers.map((teammate) => {
    const teammateLines = enrichLines(scopedLines.filter((line) => line.playerId === teammate.id), segmentSets, segmentMatches, scopedLines);
    const teammateRecentIds = new Set(
      [...new Map(teammateLines.map((line) => [line.match.id, line.match])).values()]
        .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
        .slice(0, 3)
        .map((match) => match.id),
    );
    const teammateStats = aggregateLines(teammateLines.filter((line) => teammateRecentIds.has(line.match.id)));
    const recentChampions = teammateLines
      .sort((a, b) => new Date(b.match.matchDate).getTime() - new Date(a.match.matchDate).getTime())
      .map((line) => champions.find((champion) => champion.id === line.championId))
      .filter(Boolean)
      .slice(0, 3);

    return { teammate, teammateStats, recentChampions };
  });
  const itemVersions = uniqueDdragonVersionsForPatches(playerLines.map((line) => line.set.patch));
  const versionedAssets = await Promise.all(
    itemVersions.map(async (version) => {
      const [spells, runeCatalog] = await Promise.all([fetchSpellCatalog(version), fetchRuneCatalog(version)]);
      return [version, { spells, runeCatalog }] as const;
    }),
  );
  const spellsByVersion = Object.fromEntries(versionedAssets.map(([version, assets]) => [version, assets.spells]));
  const runeCatalogByVersion = Object.fromEntries(versionedAssets.map(([version, assets]) => [version, assets.runeCatalog]));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-[var(--page-inline)] py-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <div>
            <Link href="/players" className="hover:text-foreground">선수</Link>
            <span className="mx-2">›</span>
            <span>선수 상세</span>
          </div>
          <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
            현재 구간 : {playerSegmentLabel(activeSegment)}
          </div>
        </div>

        <PlayerCriteriaFilter
          playerSlug={player.slug}
          activeSegment={activeSegment}
          visibleSegments={visibleSegments}
        />

        <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="grid overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-[15rem_1fr]" aria-labelledby="player-summary">
            <div className="bg-surface-muted p-4">
              <PlayerImage src={player.profileImageUrl} alt={player.name} className="h-full min-h-64 w-full rounded-md object-cover object-top" />
            </div>
            <div className="flex flex-col justify-between gap-5 p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h1 id="player-summary" className="text-4xl font-semibold tracking-normal">{player.name}</h1>
                </div>
                <p className="mt-2 text-lg font-semibold">{player.realName || "-"}</p>
                <PlayerSocialLinks player={player} className="mt-4" />
                <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <span>팀</span>
                    <strong className="ml-2 text-foreground">{playerTeam?.shortName ?? "-"}</strong>
                  </div>
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <span>현재 순위</span>
                    <strong className="ml-2 text-foreground">{teamStanding ? `${teamStanding.rank}위` : "-"}</strong>
                  </div>
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <span>최근 5경기</span>
                    <strong className="ml-2 text-foreground">{teamRecent || "-"}</strong>
                  </div>
                  <div className="rounded-md border border-border bg-background px-3 py-2">
                    <span>포지션</span>
                    <strong className="ml-2 text-foreground">{player.position}</strong>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  {playerTeam ? <Link href={`/teams/${playerTeam.slug}`} className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-surface-muted">팀 상세 보기</Link> : null}
                  <Link href="#teammates" className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-surface-muted">팀원 보기</Link>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3">
            <SectionCard title="선수 지표 비교" className="min-h-full">
              {aggregateStats ? <RadarChart stats={aggregateStats} averageStats={radarBenchmark?.average} /> : <p className="text-sm text-muted">표시할 경기 지표가 없습니다.</p>}
            </SectionCard>
          </div>
        </div>

        <SectionCard title="현재 구간 경기 지표">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-10">
            <MetricTile label="출전 세트 수" value={playerLines.length} />
            <MetricTile label="승률" value={percentValue(playerLines.length ? (wins / playerLines.length) * 100 : null)} helper={`${wins}W ${losses}L`} />
            <MetricTile label="KDA" value={statValue(aggregateStats?.kda, 2)} helper={playerKdaLine} />
            <MetricTile label="KP%" value={percentValue(aggregateStats?.kp)} />
            <MetricTile label="DPM" value={statValue(aggregateStats?.dpm)} />
            <MetricTile label="DMG%" value={percentValue(aggregateStats?.dmgPercent)} />
            <MetricTile label="CSM" value={statValue(aggregateStats?.csm)} />
            <MetricTile label="GPM" value={statValue(aggregateStats?.gpm)} />
            <MetricTile label="Vision Score" value={statValue(aggregateStats?.visionScoreAvg, 2)} />
            <MetricTile label="최근 폼" value={statValue(recentStats?.formScore)} />
          </div>
        </SectionCard>

        <SectionCard title="팬 / 수상 데이터">
          <div className="grid gap-3 lg:grid-cols-[1fr_1.65fr_1.45fr]">
            <div className="rounded-md border border-border bg-background/45 p-4 text-center">
              <p className="text-sm text-muted">세트 팬 평점 기반 평균</p>
              <p className="mt-3 text-4xl font-semibold">{averageRating(playerRatings)} <span className="text-base text-muted">/ 5</span></p>
              <p className="mt-2 text-2xl">★★★★★</p>
            </div>
            <div className="grid grid-cols-2 rounded-md border border-border bg-background/45">
              <div className="grid place-items-center border-r border-border p-4 text-center">
                <p className="text-sm text-muted">팬 POG 횟수</p>
                <p className="mt-3 text-4xl font-semibold">{playerFanPogSetIds.size}</p>
              </div>
              <div className="grid place-items-center p-4 text-center">
                <p className="text-sm text-muted">공식 POM 횟수</p>
                <p className="mt-3 text-4xl font-semibold">{pomCount}</p>
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/45 p-4">
              <p className="text-sm font-semibold">선수 리뷰 (제한형)</p>
              <p className="mt-3 text-sm leading-6 text-muted">
                {playerRatings.find((rating) => rating.review)?.review || "팬 평점 리뷰가 아직 충분하지 않습니다."}
              </p>
              <p className="mt-4 text-right text-xs text-muted">리뷰 {playerRatings.filter((rating) => rating.review).length}개</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="사용 챔피언">
          <DataTable
            rows={championRows}
            columns={[
              {
                key: "champion",
                label: "챔피언",
                headerClassName: "min-w-[9rem]",
                cellClassName: "min-w-[9rem]",
                render: (row) => row.champion ? (
                  <span className="inline-flex items-center gap-2">
                    <PlayerImage src={championImageUrl(row.champion)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    <MiniModalLink
                      href="/stats/champions"
                      label={championLabel(row.champion)}
                      eyebrow="챔피언 미니모달"
                      title={championLabel(row.champion)}
                      placement="top"
                      rows={[
                        { label: "픽 수", value: row.pickCount },
                        { label: "밴 수", value: row.banCount },
                        { label: "픽밴률", value: percentValue(row.pickBanRate) },
                        { label: "승률", value: percentValue(row.winRate) },
                        { label: "주요 사용 선수", value: row.mainUsers },
                      ]}
                      cta="챔피언 스탯 보기"
                    />
                  </span>
                ) : "-",
              },
              {
                key: "sets",
                label: "사용 세트 수",
                headerClassName: "w-[1%] whitespace-nowrap text-center",
                cellClassName: "w-[1%] whitespace-nowrap text-center tabular-nums",
                render: (row) => row.lines.length,
              },
              {
                key: "winRate",
                label: "승률",
                headerClassName: "w-[1%] whitespace-nowrap text-center",
                cellClassName: "w-[1%] whitespace-nowrap text-center tabular-nums",
                render: (row) => percentValue(row.winRate),
              },
              {
                key: "kda",
                label: "KDA",
                headerClassName: "w-[1%] whitespace-nowrap text-center",
                cellClassName: "w-[1%] whitespace-nowrap text-center tabular-nums",
                render: (row) => statValue(row.stats?.kda, 2),
              },
              {
                key: "rating",
                label: "평균 세트 팬 평점",
                headerClassName: "w-[1%] whitespace-nowrap text-center",
                cellClassName: "w-[1%] whitespace-nowrap text-center tabular-nums",
                render: (row) => row.avgRating,
              },
              {
                key: "pog",
                label: "팬 POG 횟수",
                headerClassName: "w-[1%] whitespace-nowrap text-center",
                cellClassName: "w-[1%] whitespace-nowrap text-center tabular-nums",
                render: (row) => row.fanPogCount,
              },
              {
                key: "recent",
                label: "최근 사용일",
                headerClassName: "w-[1%] whitespace-nowrap text-center",
                cellClassName: "w-[1%] whitespace-nowrap text-center tabular-nums",
                render: (row) => compactDate(row.recentDate),
              },
            ]}
          />
        </SectionCard>

        <SectionCard title="최근 경기 기록" aside="매치 공통 정보 + 세트별 선수 기록">
          {recentMatchRows.length === 0 ? (
            <div className="rounded-md border border-border bg-background/45 p-6 text-sm text-muted">
              최근 경기 데이터가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4">
              {recentMatchRows.map((row) => (
                <RecentMatchSetRows
                  key={row.match.id}
                  player={player}
                  teams={teams}
                  match={row.match}
                  lines={row.lines}
                  champions={champions}
                  ratings={row.ratings}
                  fanPog={row.fanPog}
                  officialPomName={row.officialPomName}
                  spellsByVersion={spellsByVersion}
                  runeCatalogByVersion={runeCatalogByVersion}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="같은 팀원" className="scroll-mt-24" aside="선수 미니모달">
          <div id="teammates" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-md border border-accent bg-background/60 p-3">
              <PlayerImage src={player.profileImageUrl} alt={player.name} className="aspect-[4/5] w-full rounded-md object-cover object-top" />
              <p className="mt-3 rounded-md bg-accent px-3 py-2 text-center text-sm font-semibold">현재 선수</p>
            </div>
            {teammates.map(({ teammate, teammateStats, recentChampions }) => (
              <article key={teammate.id} className="rounded-md border border-border bg-background/45 p-4">
                <div className="flex items-center gap-3">
                  <PlayerImage src={teammate.profileImageUrl} alt={teammate.name} className="h-16 w-16 rounded-md object-cover object-top" />
                  <div>
                    <h3 className="font-semibold">{teammate.name}</h3>
                    <p className="text-sm text-muted">{teammate.position}</p>
                    <p className="mt-1 text-xs">KDA {statValue(teammateStats?.kda, 2)}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3 text-center text-sm">
                  <p className="text-muted">최근 3경기</p>
                  <p className="mt-1">{statValue(teammateStats?.kda, 2)} / {percentValue(teammateStats?.kp)} / {statValue(teammateStats?.dpm)}</p>
                </div>
                <div className="mt-3 flex justify-center gap-2">
                  {recentChampions.map((champion, index) =>
                    champion ? <PlayerImage key={`${champion.id}-${index}`} src={championImageUrl(champion)} alt="" className="h-8 w-8 rounded-full object-cover" /> : null,
                  )}
                </div>
                <Link href={`/players/${teammate.slug}`} className="mt-4 block rounded-md bg-surface-muted px-3 py-2 text-center text-sm font-semibold">선수 상세 보기</Link>
              </article>
            ))}
          </div>
        </SectionCard>

        {awards.length > 0 ? (
          <SectionCard title="수상 내역">
            <PlayerAwardHistory awards={awards} />
          </SectionCard>
        ) : null}

        {careerHistories.length > 0 ? (
          <SectionCard title="경력">
            <CareerTimeline histories={careerHistories} teams={teams} currentTeamId={player.teamId} />
          </SectionCard>
        ) : null}

        <section className="grid gap-3 md:grid-cols-4" aria-label="이동">
          {playerTeam ? <Link href={`/teams/${playerTeam.slug}`} className="rounded-lg border border-border bg-surface p-5 text-center text-base font-semibold hover:bg-surface-muted">팀 상세 이동</Link> : null}
          <Link href="/players" className="rounded-lg border border-border bg-surface p-5 text-center text-base font-semibold hover:bg-surface-muted">같은 팀원 이동</Link>
          <Link href="/stats/players" className="rounded-lg border border-border bg-surface p-5 text-center text-base font-semibold hover:bg-surface-muted">포지션별 선수 스탯</Link>
          {featuredMatch ? <Link href={matchHref(featuredMatch.match)} className="rounded-lg border border-border bg-surface p-5 text-center text-base font-semibold hover:bg-surface-muted">최근 경기 이동</Link> : null}
        </section>

        <SourceNotice />
      </div>
    </main>
  );
}
