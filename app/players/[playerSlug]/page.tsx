import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerSocialLinks } from "@/components/domain/player-social-links";
import { SectionHeading } from "@/components/layout/section-heading";
import { Breadcrumb } from "@/components/layout/breadcrumb";

import { uniqueDdragonVersionsForPatches } from "@/lib/ddragon";
import { fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
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
import { fanPogPlayerIdForSet } from "@/lib/view-data";
import { ChampionUsageTable } from "./champion-usage-table";
import { RecentMatchHistoryModal, RecentMatchSetRows } from "./recent-match-history-modal";

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

function statValue(value: number | null | undefined, decimals = 1) {
  return value == null || Number.isNaN(value) ? "-" : value.toFixed(decimals);
}

function percentValue(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "-" : `${Math.round(value)}%`;
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

function MetricCard({
  label,
  value,
  helper,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] border border-[var(--card-border)] p-4 ${className}`}>
      <p className="text-[12px] text-[var(--ink-3)]">{label}</p>
      <p className="mt-2 font-archivo text-[32px] font-black leading-none tracking-tight text-[var(--ink)]">{value}</p>
      {helper ? <p className="mt-1.5 text-[12px] text-[var(--sub-muted)]">{helper}</p> : null}
    </div>
  );
}

// 8축 레이더 + 지표 바 리스트 (STATS OVERVIEW 내부)
function StatsOverview({
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

  const center = 130;
  const maxRadius = 90;
  const pointsFor = (values: number[]) =>
    values
      .map((value, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
        const radius = (Math.max(0, Math.min(100, value)) / 100) * maxRadius;
        return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
      })
      .join(" ");
  const playerPoints = pointsFor(axes.map((axis) => axis.score));
  const averagePoints = averageStats ? pointsFor(axes.map((axis) => axis.averageScore ?? 0)) : null;
  const gridPolys = [0.25, 0.5, 0.75, 1].map((scale) =>
    axes
      .map((_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
        const radius = maxRadius * scale;
        return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
      })
      .join(" "),
  );

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr] md:items-center">
      <svg viewBox="0 0 260 260" className="mx-auto h-[280px] w-[280px]">
        {gridPolys
          .slice()
          .reverse()
          .map((polygon, index) => (
            <polygon
              key={polygon}
              points={polygon}
              fill={index % 2 === 0 ? "#eef0f2" : "#f9fafb"}
              stroke="#e7e8eb"
            />
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
              stroke="#e7e8eb"
            />
          );
        })}
        {averagePoints ? (
          <polygon points={averagePoints} fill="rgba(154,163,181,0.16)" stroke="#9aa3b5" strokeWidth="2" />
        ) : null}
        <polygon
          points={playerPoints}
          fill="color-mix(in oklab, var(--tp) 16%, transparent)"
          stroke="var(--tp)"
          strokeWidth="2"
        />
        {axes.map((axis, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
          const x = center + Math.cos(angle) * (maxRadius + 20);
          const y = center + Math.sin(angle) * (maxRadius + 16);
          return (
            <text key={axis.label} x={x} y={y} textAnchor="middle" className="font-archivo fill-[var(--ink)] text-[11px] font-bold">
              <tspan x={x}>{axis.label}</tspan>
              <tspan x={x} dy="12" className="fill-[var(--sub-muted)] font-semibold">{Math.round(axis.score)}</tspan>
            </text>
          );
        })}
      </svg>

      {/* 한 개의 그리드로 묶어 라벨/바/점수 열을 행 간 정렬한다(바 트랙 폭 통일). */}
      <ul className="grid grid-cols-[42px_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-3 text-[12px]">
        {axes.map((axis) => (
          <li key={axis.label} className="contents">
            <span className="font-archivo font-bold text-[var(--ink)]">{axis.label}</span>
            <span className="h-[7px] w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
              <span
                className="block h-full rounded-full bg-[var(--tp)]"
                style={{ width: `${Math.max(0, Math.min(100, axis.score))}%` }}
              />
            </span>
            <span className="text-right font-bold tabular-nums text-[var(--ink)]">
              {Math.round(axis.score)}
              <span className="ml-1 font-normal text-[var(--sub-muted)]">({statValue(axis.raw, axis.decimals)})</span>
            </span>
            <span className="min-w-[64px] text-right tabular-nums text-[#9aa3b5]">
              {axis.averageScore != null
                ? `${Math.round(axis.averageScore)} (${statValue(axis.averageRaw, axis.decimals)})`
                : "-"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayerSegmentChips({
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
    <div className="flex flex-wrap gap-1.5" aria-label="대회 구간">
      {visibleSegments.map((segment) => {
        const active = activeSegment === segment;
        return (
          <Link
            key={segment}
            href={segment === "all" ? `${basePath}?segment=all` : `${basePath}?segment=${segment}`}
            className={`rounded-full px-3 py-1.5 text-[14px] font-semibold transition-colors ${
              active
                ? "bg-[var(--tp)] text-white"
                : "border border-[var(--btn-border)] bg-white text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {playerSegmentLabel(segment)}
          </Link>
        );
      })}
    </div>
  );
}

function PlayerAwardHistory({ awards }: { awards: TeamAward[] }) {
  if (awards.length === 0) return null;

  return (
    <ul className="flex flex-col">
      {awards.map((award, i) => {
        const meta = PLAYER_AWARD_META[award.awardType];
        return (
          <li key={award.id} className={`flex items-center gap-3 py-2.5 ${i !== 0 ? "border-t border-[var(--hairline)]" : ""}`}>
            <span className="w-9 shrink-0 font-archivo text-[14px] font-black tabular-nums text-[var(--ink)]">{award.year}</span>
            <span className="text-[14px] font-semibold text-[var(--ink)]">{meta?.label ?? award.awardType}</span>
            <span className="ml-auto truncate text-[12px] text-[var(--sub-muted)]">{award.tournamentName}</span>
          </li>
        );
      })}
    </ul>
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
    return <p className="text-[12px] text-[var(--sub-muted)]">경력 데이터가 없습니다.</p>;
  }

  function dateLabel(date: string | null) {
    if (!date) return "현재";
    return `${new Date(date).getFullYear()}`;
  }

  return (
    <div className="relative pl-4">
      <div className="absolute left-[3px] top-1.5 h-[calc(100%-0.75rem)] w-px bg-[var(--card-border)]" />
      <ul className="flex flex-col gap-3">
        {histories.map((entry) => {
          const team = entry.teamId ? teams.find((t) => t.id === entry.teamId) : null;
          const teamName = team?.shortName ?? entry.teamName ?? "알 수 없음";
          const isCurrent = !entry.endDate || (entry.teamId ? entry.teamId === currentTeamId : false);
          return (
            <li key={entry.id} className="relative">
              <span
                className={`absolute -left-4 top-1 h-[7px] w-[7px] rounded-full ${isCurrent ? "bg-[var(--tp)]" : "bg-[var(--sub-muted-weak)]"}`}
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-semibold text-[var(--ink)]">{teamName}</span>
                <span className="text-[12px] text-[var(--sub-muted)]">
                  {dateLabel(entry.startDate)}–{dateLabel(entry.endDate)}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{entry.position}</p>
            </li>
          );
        })}
      </ul>
    </div>
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
  const playerKdaLine =
    playerLines.length === 0
      ? "-"
      : `${playerLines.reduce((sum, line) => sum + line.kills, 0)} / ${playerLines.reduce((sum, line) => sum + line.deaths, 0)} / ${playerLines.reduce((sum, line) => sum + line.assists, 0)}`;
  // 팀원 칩(포지션 약자 + 닉네임)만 노출한다.
  const teammates = sameTeamPlayers.map((teammate) => ({ teammate }));
  const itemVersions = uniqueDdragonVersionsForPatches(playerLines.map((line) => line.set.patch));
  const versionedAssets = await Promise.all(
    itemVersions.map(async (version) => {
      const [spells, runeCatalog] = await Promise.all([fetchSpellCatalog(version), fetchRuneCatalog(version)]);
      return [version, { spells, runeCatalog }] as const;
    }),
  );
  const spellsByVersion = Object.fromEntries(versionedAssets.map(([version, assets]) => [version, assets.spells]));
  const runeCatalogByVersion = Object.fromEntries(versionedAssets.map(([version, assets]) => [version, assets.runeCatalog]));

  const fanRatingValue = averageRating(playerRatings);
  const filledStars = fanRatingValue === "-" ? 0 : Math.round(Number(fanRatingValue));
  const reviewQuote = playerRatings.find((rating) => rating.review)?.review;
  const reviewCount = playerRatings.filter((rating) => rating.review).length;

  return (
    <main
      className="subpage min-h-screen"
      style={{ ["--tp" as string]: playerTeam?.primaryColor ?? "#6158ff" }}
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-12 px-10 py-8 max-md:px-5">
        {/* 1. 브레드크럼 + 대회 세그먼트 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb items={[{ label: "선수단", href: "/players" }, { label: player.position }, { label: player.name }]} />
          <PlayerSegmentChips
            playerSlug={player.slug}
            activeSegment={activeSegment}
            visibleSegments={visibleSegments}
          />
        </div>

        {/* 2. 팀 메타 스트립 */}
        <div className="flex flex-wrap items-center gap-4 rounded-[16px] border border-[var(--card-border)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-[var(--ink-3)]">팀</span>
            {playerTeam?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playerTeam.logoUrl} alt={playerTeam.name} className="h-[30px] w-auto object-contain" />
            ) : (
              <span className="text-[14px] font-bold">{playerTeam?.shortName ?? "-"}</span>
            )}
          </div>
          <span className="hidden h-[22px] w-px bg-[#f0ede8] sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] text-[var(--ink-3)]">순위</span>
            <span className="text-[16px] font-bold" style={{ color: "var(--tp)" }}>
              {teamStanding ? `${teamStanding.rank}위` : "-"}
            </span>
          </div>
          <span className="hidden h-[22px] w-px bg-[#f0ede8] sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] text-[var(--ink-3)]">최근 5경기</span>
            <span className="text-[16px] font-bold tracking-wide text-[var(--ink)]">{teamRecent || "-"}</span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {playerTeam ? (
              <Link
                href={`/teams/${playerTeam.slug}`}
                className="rounded-full bg-[var(--ink)] px-4 py-2 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                팀 상세 보기
              </Link>
            ) : null}
            <Link
              href="#teammates"
              className="rounded-full border border-[var(--btn-border)] px-4 py-2 text-[14px] font-semibold text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)]"
            >
              팀원 보기
            </Link>
          </div>
        </div>

        {/* 3. 메인 그리드 — 포트레잇 + STATS OVERVIEW */}
        <div className="grid gap-10 lg:grid-cols-[330px_1fr]">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[18px] bg-[var(--surface-1)]">
            <PlayerImage src={player.profileImageUrl} alt={player.name} className="h-full w-full object-cover object-top" />
            <span className="absolute left-3 top-3 rounded-[4px] px-2 py-1 text-[12px] font-bold text-white" style={{ background: "var(--tp)" }}>
              {player.position}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[rgba(12,11,15,0.82)] via-[rgba(12,11,15,0.4)] to-transparent px-4 pb-4 pt-14">
              <div className="min-w-0">
                <h1 className="font-archivo text-[32px] font-black leading-none tracking-tight text-white">{player.name}</h1>
                {player.realName ? <p className="mt-1.5 text-[12px] text-white/75">{player.realName}</p> : null}
              </div>
              <PlayerSocialLinks player={player} variant="overlay" className="shrink-0" />
            </div>
          </div>

          <section aria-labelledby="stats-overview">
            <SectionHeading
              title="STATS OVERVIEW"
              aside={
                <div className="flex items-center gap-3 pb-[2px] text-[12px] text-[var(--ink-3)]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--tp)" }} />선수
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#9aa3b5]" />동 포지션 평균
                  </span>
                </div>
              }
            />
            <div className="mt-5">
              {aggregateStats ? (
                <StatsOverview stats={aggregateStats} averageStats={radarBenchmark?.average} />
              ) : (
                <p className="text-[14px] text-[var(--sub-muted)]">표시할 경기 지표가 없습니다.</p>
              )}
            </div>
          </section>
        </div>

        {/* 4. CURRENT SPLIT */}
        <section>
          <SectionHeading title="CURRENT SPLIT" caption={playerSegmentLabel(activeSegment)} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="출전 세트 수" value={playerLines.length} />
            <MetricCard
              label="승률"
              value={percentValue(playerLines.length ? (wins / playerLines.length) * 100 : null)}
              helper={`${wins}W ${losses}L`}
            />
            <MetricCard label="KDA" value={statValue(aggregateStats?.kda, 2)} helper={playerKdaLine} />
            <MetricCard label="최근 폼" value={statValue(recentStats?.formScore)} />
          </div>
        </section>

        {/* 5. FAN & AWARDS */}
        <section>
          <SectionHeading title="FAN & AWARDS" />
          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1.6fr]">
            <div
              className="rounded-[14px] border border-[var(--card-border)] p-4"
              style={{ background: "color-mix(in oklab, var(--tp) 5%, #fff)" }}
            >
              <p className="text-[12px] text-[var(--ink-3)]">세트 팬 평점</p>
              <p className="mt-2 font-archivo text-[32px] font-black leading-none text-[var(--ink)]">
                {fanRatingValue}
                <span className="ml-1 font-sans text-[14px] font-semibold text-[var(--sub-muted)]">/ 5</span>
              </p>
              <p className="mt-2 text-[16px] tracking-[2px]" style={{ color: "var(--tp)" }}>
                {"★".repeat(filledStars)}
                <span className="text-[var(--sub-muted-weak)]">{"★".repeat(Math.max(0, 5 - filledStars))}</span>
              </p>
            </div>
            <MetricCard label="팬 POG" value={playerFanPogSetIds.size} />
            <MetricCard label="공식 POM" value={pomCount} />
            <div className="flex flex-col rounded-[14px] border border-[var(--card-border)] p-4">
              <p className="text-[12px] font-semibold text-[var(--ink-3)]">선수 리뷰</p>
              <p className="mt-2 line-clamp-3 flex-1 text-[14px] leading-6 text-[var(--ink-2)]">
                {reviewQuote ? `“${reviewQuote}”` : "팬 평점 리뷰가 아직 충분하지 않습니다."}
              </p>
              <p className="mt-3 text-right text-[12px] text-[var(--sub-muted)]">리뷰 {reviewCount}개 · 전체 보기 →</p>
            </div>
          </div>
        </section>

        {/* 6. CHAMPIONS */}
        <section>
          <SectionHeading title="CHAMPIONS" caption="사용 챔피언" />
          <div className="mt-1.5">
            <ChampionUsageTable rows={championRows} />
          </div>
        </section>

        {/* 7. RECENT MATCH */}
        <section>
          <SectionHeading
            title="RECENT MATCH"
            aside={
              <RecentMatchHistoryModal
                player={player}
                teams={teams}
                rows={recentMatchRows}
                champions={champions}
                spellsByVersion={spellsByVersion}
                runeCatalogByVersion={runeCatalogByVersion}
              />
            }
          />
          <div className="mt-5">
            {recentMatchRows.length === 0 ? (
              <div className="rounded-[16px] border border-[var(--card-border)] p-6 text-[14px] text-[var(--sub-muted)]">
                최근 경기 데이터가 없습니다.
              </div>
            ) : (
              recentMatchRows.slice(0, 1).map((row) => (
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
              ))
            )}
          </div>
        </section>

        {/* 8. CAREER / AWARDS / TEAMMATES */}
        <div id="teammates" className="grid gap-8 scroll-mt-24 md:grid-cols-3">
          <section>
            <h3 className="border-b border-[var(--btn-border)] pb-2 text-[14px] font-bold text-[var(--ink-2)]">CAREER</h3>
            <div className="mt-4">
              <CareerTimeline histories={careerHistories} teams={teams} currentTeamId={player.teamId} />
            </div>
          </section>

          <section>
            <h3 className="border-b border-[var(--btn-border)] pb-2 text-[14px] font-bold text-[var(--ink-2)]">AWARDS</h3>
            <div className="mt-4">
              {awards.length > 0 ? (
                <PlayerAwardHistory awards={awards} />
              ) : (
                <p className="text-[12px] text-[var(--sub-muted)]">수상 내역이 없습니다.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="border-b border-[var(--btn-border)] pb-2 text-[14px] font-bold text-[var(--ink-2)]">TEAMMATES</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {teammates.length === 0 ? (
                <p className="text-[12px] text-[var(--sub-muted)]">등록된 팀원이 없습니다.</p>
              ) : (
                teammates.map(({ teammate }) => (
                  <Link
                    key={teammate.id}
                    href={`/players/${teammate.slug}`}
                    className="fan-roster-chip inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-3.5 py-2 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span className="text-[11px] font-extrabold" style={{ color: "var(--tp)" }}>
                      {teammate.position}
                    </span>
                    <span className="font-archivo text-[14px] font-black text-[var(--ink)]">{teammate.name}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
