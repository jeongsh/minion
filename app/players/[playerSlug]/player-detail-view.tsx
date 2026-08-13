import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerSocialLinks } from "@/components/domain/player-social-links";
import { PageHeader } from "@/components/ui/page-header";
import { AdSlot } from "@/components/ui/ad-slot";
import { SectionHeading } from "@/components/ui/section-heading";

import { uniqueDdragonVersionsForPatches } from "@/lib/ddragon";
import { fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
import {
  getPlayerBySlug,
  getPlayerPomCount,
  getPlayerStatLines,
} from "@/lib/data/lck";
import {
  getPlayerPageSegmentData,
  getPlayerPageSharedData,
} from "@/lib/data/player-cache";
import { aggregatePlayerStatLine, calculatePlayerStats, type PlayerRadarBenchmark } from "@/lib/stats";
import type { FanRating, Match, PlayerStatLine, SetResult, Tournament } from "@/lib/types";
import {
  filterMatchesBySegment,
  filterSetsByMatches,
  parseSeasonSegment,
  segmentLabel,
  type SeasonSegmentKey,
} from "@/lib/tournament-filters";
import { fanPogPlayerIdForSet, setRatingHref } from "@/lib/view-data";
import { ChampionUsageTable } from "./champion-usage-table";
import { FanReviewList, type FanReviewItem } from "./fan-review-list";
import { RecentMatchHistoryModal, RecentMatchSetRows } from "./recent-match-history-modal";
import type { Crumb } from "@/components/layout/breadcrumb";

const PLAYER_PAGE_SEGMENTS: Array<SeasonSegmentKey | "all"> = [
  "all",
  "lck-cup",
  "lck",
  "first-stand",
  "msi",
  "ewc",
  "worlds",
  "enc",
  "kespa-cup",
];

function playerSegmentLabel(segment: SeasonSegmentKey | "all") {
  if (segment === "all") return "2026 전체";
  if (segment === "lck") return "2026 LCK 통합";
  return segmentLabel(segment);
}

/** playerLines 는 이미 해당 선수 본인의 스탯라인만 담고 있으므로 setId 소속만 확인한다. */
function segmentHasPlayerData(
  segment: SeasonSegmentKey | "all",
  playerLines: PlayerStatLine[],
  matches: Match[],
  tournaments: Tournament[],
  sets: SetResult[],
) {
  const segmentMatches = filterMatchesBySegment(matches, tournaments, segment);
  const segmentSetIds = new Set(filterSetsByMatches(sets, segmentMatches).map((set) => set.id));
  return playerLines.some((line) => segmentSetIds.has(line.setId));
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

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
    return <div className={`${className} bg-[var(--ui-card-bg)]`} aria-label={alt} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

// 8축 레이더 + 지표 바 리스트 (선수 지표 내부)
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
              fill={index % 2 === 0 ? "var(--ui-surface-muted)" : "var(--ui-surface)"}
              stroke="var(--ui-border)"
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
              stroke="var(--ui-border)"
            />
          );
        })}
        {averagePoints ? (
          <polygon points={averagePoints} fill="color-mix(in oklab, var(--ui-muted) 18%, transparent)" stroke="var(--ui-muted)" strokeWidth="2" />
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
            <text key={axis.label} x={x} y={y} textAnchor="middle" className="fill-[var(--ui-ink)] text-[13px] font-bold">
              <tspan x={x}>{axis.label}</tspan>
              <tspan x={x} dy="12" className="fill-[var(--ui-muted)] font-semibold">{Math.round(axis.score)}</tspan>
            </text>
          );
        })}
      </svg>

      {/* 한 개의 그리드로 묶어 라벨/바/점수 열을 행 간 정렬한다(바 트랙 폭 통일). */}
      <ul className="grid grid-cols-[42px_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-3 text-[13px]">
        {axes.map((axis) => (
          <li key={axis.label} className="contents">
            <span className="font-bold text-[var(--ui-ink)]">{axis.label}</span>
            <span className="h-[7px] w-full overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
              <span
                className="block h-full rounded-full bg-[var(--tp)]"
                style={{ width: `${Math.max(0, Math.min(100, axis.score))}%` }}
              />
            </span>
            <span className="text-right font-bold tabular-nums text-[var(--ui-ink)]">
              {Math.round(axis.score)}
              <span className="ml-1 font-normal text-[var(--ui-muted)]">({statValue(axis.raw, axis.decimals)})</span>
            </span>
            <span className="min-w-[64px] text-right tabular-nums text-[var(--ui-muted)]">
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
  linkBase = "/players",
  className = "",
}: {
  playerSlug: string;
  activeSegment: SeasonSegmentKey | "all";
  visibleSegments: Array<SeasonSegmentKey | "all">;
  linkBase?: string;
  className?: string;
}) {
  const basePath = `${linkBase}/${playerSlug}`;
  return (
    <div className={`flex gap-1.5 ${className}`} aria-label="대회 구간">
      {visibleSegments.map((segment) => {
        const active = activeSegment === segment;
        return (
          <Link
            key={segment}
            href={segment === "all" ? `${basePath}?segment=all` : `${basePath}?segment=${segment}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--tp)] text-white"
                : "border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:bg-[var(--ui-card-hover)]"
            }`}
          >
            {playerSegmentLabel(segment)}
          </Link>
        );
      })}
    </div>
  );
}

export async function PlayerDetailView({
  playerSlug,
  segment,
  linkBase = "/players",
  breadcrumbLead = [{ label: "???", href: "/players" }],
  showPosition = false,
}: {
  playerSlug: string;
  segment?: string;
  linkBase?: string;
  breadcrumbLead?: Crumb[];
  showPosition?: boolean;
}) {
  const query = { segment };
  const player = await getPlayerBySlug(playerSlug);

  if (!player) {
    notFound();
  }

  const [sharedData, playerOwnLines, pomCount] = await Promise.all([
    getPlayerPageSharedData(),
    // 이 선수 본인의 스탯라인만(리그 전체가 아님) — 구간 탭 표시 여부 판단용.
    getPlayerStatLines(undefined, player.id),
    getPlayerPomCount(player.id),
  ]);
  const { teams, players, matches, sets, fanRatings, tournaments, champions, standings } = sharedData;
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const setById = new Map(sets.map((set) => [set.id, set]));

  const visibleSegments = PLAYER_PAGE_SEGMENTS.filter((segment) =>
    segmentHasPlayerData(segment, playerOwnLines, matches, tournaments, sets),
  );
  const requestedSegment = query.segment == null ? "all" : parseSeasonSegment(query.segment);
  const activeSegment = visibleSegments.includes(requestedSegment)
    ? requestedSegment
    : (visibleSegments[0] ?? "all");
  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);
  const segmentSets = filterSetsByMatches(sets, segmentMatches);
  const segmentSetIds = segmentSets.map((set) => set.id);
  const [playerSegmentLines, segmentData] = segmentSetIds.length
    ? await Promise.all([
      getPlayerStatLines(segmentSetIds, player.id),
      getPlayerPageSegmentData(segmentSetIds),
    ])
    : [[], { radarBenchmarkByPosition: {}, pickBanByChampion: {}, mainUserIdsByChampion: {} }];
  const playerLines = enrichLines(playerSegmentLines, segmentSets, segmentMatches);
  const radarBenchmark = segmentData.radarBenchmarkByPosition[player.position];
  const aggregateStats = aggregateLines(playerLines, radarBenchmark);
  const playerTeam = teams.find((team) => team.id === player.teamId);
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
      const pickBan = segmentData.pickBanByChampion[championId] ?? { pickCount: 0, banCount: 0 };
      const pickCount = pickBan.pickCount;
      const banCount = pickBan.banCount;
      const mainUsers =
        (segmentData.mainUserIdsByChampion[championId] ?? [])
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
        avgDamage: lines.length === 0 ? null : lines.reduce((sum, line) => sum + line.damageToChampions, 0) / lines.length,
        avgRating: averageRating(championRatings),
        fanPogCount: championPogCount,
        pickCount,
        banCount,
        pickBanRate: segmentSets.length === 0 ? null : ((pickCount + banCount) / segmentSets.length) * 100,
        mainUsers,
      };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  const recentMatchRows = completedPlayerMatches.map((match) => {
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
  const playerReviews = playerRatings
    .filter((rating) => rating.review.trim())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const fanReviewItems: FanReviewItem[] = playerReviews.map((rating) => {
    const match = matchById.get(rating.matchId);
    const set = setById.get(rating.setId);

    return {
      rating,
      href: match && set ? setRatingHref(match, set) : null,
      meta: [
        formatReviewDate(rating.createdAt),
        match?.name,
        set ? `${set.setNumber}세트` : null,
      ].filter(Boolean).join(" · "),
    };
  });

  return (
    <main
      className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]"
      style={
        {
          "--tp": playerTeam?.primaryColor ?? "#6158ff",
          // Breadcrumb 등 공용 컴포넌트가 참조하는 서브페이지 토큰을 --ui-* 로 브리지(다크모드 대응).
          "--ink": "var(--ui-ink)",
          "--ink-3": "var(--ui-muted)",
          "--sub-muted-weak": "var(--ui-border)",
        } as React.CSSProperties
      }
    >
      <div className="layout-wide flex flex-col gap-7 pb-16 pt-6 sm:pt-8 md:gap-12">
        {/* 1. 브레드크럼 + 대회 세그먼트 */}
        <PageHeader
          title={player.name}
          breadcrumbs={[{ label: "선수단", href: "/players" }, { label: player.position }, { label: player.name }]}
          action={
            <PlayerSegmentChips
              playerSlug={player.slug}
              activeSegment={activeSegment}
              visibleSegments={visibleSegments}
              linkBase={linkBase}
              className="hidden flex-wrap md:flex"
            />
          }
        />
        <div className="-mt-3 flex overflow-x-auto pb-1 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><PlayerSegmentChips playerSlug={player.slug} activeSegment={activeSegment} visibleSegments={visibleSegments} linkBase={linkBase} className="shrink-0" /></div>

        {/* 2. 팀 메타 스트립 */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-[var(--ui-muted)]">팀</span>
            {playerTeam?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playerTeam.logoUrl} alt={playerTeam.name} className="h-[30px] w-auto object-contain" />
            ) : (
              <span className="text-sm font-bold text-[var(--ui-ink)]">{playerTeam?.shortName ?? "-"}</span>
            )}
          </div>
          <span className="hidden h-[22px] w-px bg-[var(--ui-border)] sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-[var(--ui-muted)]">순위</span>
            <span className="text-base font-bold" style={{ color: "var(--tp)" }}>
              {teamStanding ? `${teamStanding.rank}위` : "-"}
            </span>
          </div>
          <span className="hidden h-[22px] w-px bg-[var(--ui-border)] sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-[var(--ui-muted)]">최근 5경기</span>
            <span className="text-base font-bold tracking-wide text-[var(--ui-ink)]">{teamRecent || "-"}</span>
          </div>
          <div className="ml-auto hidden flex-wrap gap-2 md:flex">
            {playerTeam ? (
              <Link
                href={`/teams/${playerTeam.slug}`}
                className="rounded-full bg-[var(--ui-ink)] px-4 py-2 text-sm font-semibold text-[var(--ui-surface)] transition-opacity hover:opacity-90"
              >
                팀 상세 보기
              </Link>
            ) : null}
          </div>
        </div>

        {/* 3. 메인 그리드 — 포트레잇 + 선수 지표 */}
        <div className="grid gap-5 min-[1200px]:grid-cols-[330px_1fr] min-[1200px]:gap-10">
          <div className="relative h-52 w-full overflow-hidden rounded-2xl bg-[var(--ui-card-bg)] sm:h-64 min-[1200px]:!h-[323px]">
            <PlayerImage src={player.profileImageUrl} alt={player.name} className="h-full w-full object-contain object-top min-[1200px]:object-cover" />
            <span className="absolute left-3 top-3 rounded-lg px-2 py-1 text-[13px] font-bold text-white" style={{ background: "var(--tp)" }}>
              {player.position}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[rgba(12,11,15,0.82)] via-[rgba(12,11,15,0.4)] to-transparent px-4 pb-4 pt-14">
              <div className="min-w-0">
                {player.realName ? <p className="mt-1.5 text-[13px] text-white/75">{player.realName}</p> : null}
              </div>
              <PlayerSocialLinks player={player} variant="overlay" className="shrink-0" />
            </div>
          </div>

          <section aria-labelledby="stats-overview">
            <SectionHeading
              aside={
                <div className="flex items-center gap-3 pb-0.5 text-[13px] text-[var(--ui-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--tp)" }} />선수
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[var(--ui-muted)]" />동 포지션 평균
                  </span>
                </div>
              }
            >선수 지표</SectionHeading>
            {aggregateStats ? (
              <StatsOverview stats={aggregateStats} averageStats={radarBenchmark?.average} />
            ) : (
              <p className="text-sm text-[var(--ui-muted)]">표시할 경기 지표가 없습니다.</p>
            )}
          </section>
        </div>

        {/* 4. 시즌 요약 */}
        <section>
          <SectionHeading caption={playerSegmentLabel(activeSegment)}>시즌 요약</SectionHeading>
          <div className="overflow-hidden rounded-lg border border-[var(--ui-border)]">
            <div className="overflow-hidden bg-[var(--ui-surface)]">
              <div className="grid h-9 grid-cols-5 items-center bg-[var(--ui-card-bg)] text-center text-xs font-semibold leading-tight text-[var(--ui-muted)] lg:text-sm">
                <span>출전 세트</span>
                <span>승률</span>
                <span>KDA</span>
                <span>최근 폼</span>
                <span>공식 POM</span>
              </div>
              <div className="grid min-h-12 grid-cols-5 items-center divide-x divide-[var(--ui-border)] text-center">
                <strong className="px-1 text-base tabular-nums text-[var(--ui-ink)] sm:text-lg">{playerLines.length}</strong>
                <div className="min-w-0 px-1">
                  <strong className="text-base tabular-nums text-[var(--ui-ink)] sm:text-lg">{percentValue(playerLines.length ? (wins / playerLines.length) * 100 : null)}</strong>
                  <span className="ml-1.5 hidden whitespace-nowrap text-xs text-[var(--ui-muted)] lg:inline">{wins}W {losses}L</span>
                </div>
                <div className="min-w-0 px-1">
                  <strong className="text-base tabular-nums text-[var(--ui-ink)] sm:text-lg">{statValue(aggregateStats?.kda, 2)}</strong>
                  <span className="ml-1.5 hidden whitespace-nowrap text-xs text-[var(--ui-muted)] xl:inline">{playerKdaLine}</span>
                </div>
                <strong className="px-1 text-base tabular-nums text-[var(--ui-ink)] sm:text-lg">{statValue(recentStats?.formScore)}</strong>
                <strong className="px-1 text-base tabular-nums text-[var(--ui-ink)] sm:text-lg">{pomCount}</strong>
              </div>
            </div>
          </div>
        </section>

        <AdSlot placement="horizontal" className="hidden h-[60px] md:block xl:h-[90px]" />

        {/* 5. 챔피언 */}
        <section>
          <SectionHeading caption={`전체 ${championRows.length}개`}>챔피언</SectionHeading>
          <ChampionUsageTable rows={championRows} />
        </section>

        {/* 6. 최근 경기 */}
        <section>
          <SectionHeading
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
          >최근 경기</SectionHeading>
          {recentMatchRows.length === 0 ? (
            <div className="rounded-2xl border border-[var(--ui-border)] p-6 text-sm text-[var(--ui-muted)]">
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
                variant="embedded"
              />
            ))
          )}
        </section>

        {/* 7. 팬 평가 */}
        <section id="fan-reviews" className="scroll-mt-24">
          <div className="mb-3 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">팬 평가</h2>
            <span className="text-sm font-semibold text-[var(--ui-muted)]">
              팬 평점 <span className="font-bold tabular-nums text-[var(--ui-ink)]">{fanRatingValue}</span>
            </span>
            <span className="text-sm font-semibold text-[var(--ui-muted)]">
              팬 POG <span className="font-bold tabular-nums text-[var(--ui-ink)]">{playerFanPogSetIds.size}</span>
            </span>
          </div>

          {playerReviews.length > 0 ? (
            <FanReviewList items={fanReviewItems} />
          ) : (
            <div className="rounded-xl bg-[var(--ui-card-bg)] p-4 text-base leading-7 text-[var(--ui-muted)]">
              작성된 선수 리뷰가 아직 없습니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
