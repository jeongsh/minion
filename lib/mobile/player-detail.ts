import type { MobilePlayerDetailDto } from "@/packages/contracts/src/mobile-v1";
import { championImage, championLabel } from "@/lib/champions";
import {
  getPlayerBySlug,
  getPlayerMetricStatLines,
  getTeamRecentResults,
  getCompletedSetIdsForTournaments,
  getPlayerSetRatingMetrics,
  getPlayerReviewPage,
} from "@/lib/data/lck";
import {
  getPlayerPageSegmentData,
  getPlayerPageSharedData,
  getPlayerFanPogSetIds,
} from "@/lib/data/player-cache";
import { getPlayerHistoryPage, mobilePlayerHistory } from "@/lib/data/player-history";
import { toMobileTeam, toMobilePlayerReview } from "@/lib/mobile/api-response";
import { playerReviewItems } from "@/lib/player-reviews";
import { getPlayerSocialLinks } from "@/lib/player-social";
import {
  aggregatePlayerStatLine,
  calculatePlayerStats,
  type PlayerRadarBenchmark,
} from "@/lib/stats";
import {
  filterMatchesBySegment,
  filterSetsByMatches,
  parseSeasonSegment,
  segmentLabel,
  type SeasonSegmentKey,
  tournamentsInSegment,
} from "@/lib/tournament-filters";
import type { FanRating, Match, PlayerStatLine, SetResult, Tournament } from "@/lib/types";

const PLAYER_PAGE_SEGMENTS: Array<SeasonSegmentKey | "all"> = [
  "all",
  "lck-cup",
  "lck",
  "first-stand",
  "msi",
  "ewc",
  "demacia-cup",
  "worlds",
  "enc",
  "kespa-cup",
];

type EnrichedLine = PlayerStatLine & {
  match: Match;
  set: SetResult;
  stats: ReturnType<typeof calculatePlayerStats>;
};

function playerSegmentLabel(segment: SeasonSegmentKey | "all") {
  if (segment === "all") return "2026 전체";
  if (segment === "lck") return "2026 LCK 통합";
  return segmentLabel(segment);
}

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

function enrichLines(lines: PlayerStatLine[], sets: SetResult[], matches: Match[]): EnrichedLine[] {
  const setById = new Map(sets.map((set) => [set.id, set]));
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const teamKillsBySetTeam = new Map<string, number>();

  for (const line of lines) {
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

function aggregateLines(lines: PlayerStatLine[], radarBenchmark?: PlayerRadarBenchmark) {
  const line = aggregatePlayerStatLine(lines);
  return line ? calculatePlayerStats(line, radarBenchmark) : null;
}

function averageRating(ratings: Pick<FanRating, "rating">[]) {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
}

async function getDetailReviews(playerId: string, setIds: string[], paginated: boolean) {
  const first = await getPlayerReviewPage(playerId, setIds);
  if (paginated) return first;
  // 기존 설치 앱에는 리뷰 전체를 유지하되 해당 선수의 공개 리뷰만 읽는다.
  const ratings = [...first.ratings];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await getPlayerReviewPage(playerId, setIds, cursor);
    ratings.push(...page.ratings);
    cursor = page.nextCursor;
  }
  return { ratings, nextCursor: null };
}

export async function getMobilePlayerDetail(
  playerSlug: string,
  requestedSegmentValue?: string | null,
  paginatedReviews = false,
  paginatedHistory = false,
): Promise<MobilePlayerDetailDto | null> {
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return null;

  const [sharedData, playerOwnLines] = await Promise.all([
    getPlayerPageSharedData(player.id),
    // 이 선수 전체 스탯라인. 구간 탭 판단 + 아래 구간 필터 소스로 재사용한다.
    getPlayerMetricStatLines(player.id),
  ]);
  const { teams, matches, sets, tournaments, champions, standings } = sharedData;
  // POM 횟수는 이미 로드된 matches 로 센다(별도 count 쿼리 불필요).
  const pomCount = matches.filter((match) => match.officialPomPlayerId === player.id).length;
  const visibleSegments = PLAYER_PAGE_SEGMENTS.filter((segment) =>
    segmentHasPlayerData(segment, playerOwnLines, matches, tournaments, sets),
  );
  const requestedSegment = requestedSegmentValue == null ? "all" : parseSeasonSegment(requestedSegmentValue);
  const activeSegment = visibleSegments.includes(requestedSegment)
    ? requestedSegment
    : (visibleSegments[0] ?? "all");
  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);
  const segmentSets = filterSetsByMatches(sets, segmentMatches).filter((set) => set.winnerTeamId);
  const segmentSetIds = await getCompletedSetIdsForTournaments(tournamentsInSegment(tournaments, activeSegment).map(tournament => tournament.id));
  // 이 선수의 구간 스탯라인은 이미 받아온 playerOwnLines 에서 걸러 쓴다(중복 쿼리 제거).
  const segmentSetIdSet = new Set(segmentSetIds);
  const playerSegmentLines = playerOwnLines.filter((line) => segmentSetIdSet.has(line.setId));
  const playerLines = enrichLines(playerSegmentLines, segmentSets, segmentMatches);
  // Catalogs depend on the selected games, not on the league benchmark query.
  const playerSetIds = playerLines.map((line) => line.setId);
  const [segmentData, historyPage, playerRatings, fanPogSetIds, reviewPage] = await Promise.all([
    getPlayerPageSegmentData(segmentSetIds, player.position),
    getPlayerHistoryPage(player.slug, activeSegment, null, paginatedHistory ? 1 : 50),
    getPlayerSetRatingMetrics(player.id, playerSetIds),
    getPlayerFanPogSetIds(player.id, playerSetIds),
    getDetailReviews(player.id, playerSetIds, paginatedReviews),
  ]);
  const radarBenchmark = segmentData.radarBenchmarkByPosition[player.position];
  const aggregateStats = aggregateLines(playerLines, radarBenchmark);
  const playerTeam = teams.find((team) => team.id === player.teamId);
  const teamStanding = standings.find((standing) => standing.teamId === player.teamId);
  const teamRecent = await getTeamRecentResults(player.teamId, tournamentsInSegment(tournaments, activeSegment).map(tournament => tournament.id));

  const playerFanPogSetIds = new Set(fanPogSetIds);
  const completedPlayerMatches = [...new Map(playerLines.map((line) => [line.match.id, line.match])).values()]
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const recentMatchIds = new Set(completedPlayerMatches.slice(0, 3).map((match) => match.id));
  const recentStats = aggregateLines(
    playerLines.filter((line) => recentMatchIds.has(line.match.id)),
    radarBenchmark,
  );
  const wins = playerLines.filter((line) => line.set.winnerTeamId === player.teamId).length;
  const losses = Math.max(playerLines.length - wins, 0);
  const playerKdaLine = playerLines.length === 0
    ? "-"
    : `${playerLines.reduce((sum, line) => sum + line.kills, 0)} / ${playerLines.reduce((sum, line) => sum + line.deaths, 0)} / ${playerLines.reduce((sum, line) => sum + line.assists, 0)}`;


  const championRows = [...new Set(playerLines.map((line) => line.championId).filter(Boolean) as string[])]
    .map((championId) => {
      const champion = champions.find((item) => item.id === championId);
      const lines = playerLines.filter((line) => line.championId === championId);
      const stats = aggregateLines(lines);
      const championWins = lines.filter((line) => line.set.winnerTeamId === player.teamId).length;
      const championRatings = playerRatings.filter(
        (rating) => lines.some((line) => line.setId === rating.setId),
      );
      const image = championImage(champion);
      return {
        id: champion?.id ?? null,
        slug: champion?.slug ?? null,
        name: championLabel(champion),
        image: image ? { url: image } : null,
        setCount: lines.length,
        winRate: lines.length === 0 ? null : (championWins / lines.length) * 100,
        kda: stats?.kda ?? null,
        averageDamage: lines.length === 0
          ? null
          : lines.reduce((sum, line) => sum + line.damageToChampions, 0) / lines.length,
        dpm: stats?.dpm ?? null,
        csm: stats?.csm ?? null,
        averageRating: averageRating(championRatings),
        fanPogCount: lines.filter((line) => playerFanPogSetIds.has(line.setId)).length,
      };
    })
    .sort((a, b) => b.setCount - a.setCount);

  const recentMatches = historyPage ? mobilePlayerHistory(historyPage) : [];
  if (!paginatedHistory && historyPage) {
    let cursor = historyPage.nextCursor;
    while (cursor) {
      const page = await getPlayerHistoryPage(player.slug, activeSegment, cursor, 50);
      if (!page) break;
      recentMatches.push(...mobilePlayerHistory(page));
      cursor = page.nextCursor;
    }
  }

  const reviews = playerReviewItems(reviewPage.ratings, matches, sets).map(toMobilePlayerReview);

  const averageStats = radarBenchmark?.average;
  const axes: MobilePlayerDetailDto["axes"] = aggregateStats ? [
    { label: "KDA", score: aggregateStats.radarKda, raw: aggregateStats.kda, averageScore: averageStats?.radarKda ?? null, averageRaw: averageStats?.kda ?? null, decimals: 2 },
    { label: "DPM", score: aggregateStats.radarDpm, raw: aggregateStats.dpm, averageScore: averageStats?.radarDpm ?? null, averageRaw: averageStats?.dpm ?? null, decimals: 1 },
    { label: "VS", score: aggregateStats.radarVision, raw: aggregateStats.visionScoreAvg, averageScore: averageStats?.radarVision ?? null, averageRaw: averageStats?.visionScoreAvg ?? null, decimals: 2 },
    { label: "CSM", score: aggregateStats.radarCsm, raw: aggregateStats.csm, averageScore: averageStats?.radarCsm ?? null, averageRaw: averageStats?.csm ?? null, decimals: 1 },
    { label: "GD10", score: aggregateStats.radarGoldDiffAt10, raw: aggregateStats.goldDiffAt10, averageScore: averageStats?.radarGoldDiffAt10 ?? null, averageRaw: averageStats?.goldDiffAt10 ?? null, decimals: 1 },
    { label: "XPD10", score: aggregateStats.radarXpDiffAt10, raw: aggregateStats.xpDiffAt10, averageScore: averageStats?.radarXpDiffAt10 ?? null, averageRaw: averageStats?.xpDiffAt10 ?? null, decimals: 1 },
    { label: "GD15", score: aggregateStats.radarGoldDiffAt15, raw: aggregateStats.goldDiffAt15, averageScore: averageStats?.radarGoldDiffAt15 ?? null, averageRaw: averageStats?.goldDiffAt15 ?? null, decimals: 1 },
    { label: "XPD15", score: aggregateStats.radarXpDiffAt15, raw: aggregateStats.xpDiffAt15, averageScore: averageStats?.radarXpDiffAt15 ?? null, averageRaw: averageStats?.xpDiffAt15 ?? null, decimals: 1 },
  ] : [];

  return {
    schemaVersion: 2,
    player: {
      id: player.id,
      name: player.name,
      position: player.position,
      profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null,
      realName: player.realName,
      slug: player.slug,
      socialLinks: getPlayerSocialLinks(player),
      teamId: player.teamId,
    },
    team: playerTeam ? toMobileTeam(playerTeam) : null,
    segments: visibleSegments.map((segment) => ({ value: segment, label: playerSegmentLabel(segment) })),
    activeSegment,
    teamMeta: { rank: teamStanding?.rank ?? null, recent: teamRecent },
    axes,
    season: {
      label: playerSegmentLabel(activeSegment),
      setCount: playerLines.length,
      wins,
      losses,
      winRate: playerLines.length ? (wins / playerLines.length) * 100 : null,
      kda: aggregateStats?.kda ?? null,
      kdaLine: playerKdaLine,
      formScore: recentStats?.formScore ?? null,
      pomCount,
    },
    champions: championRows,
    recentMatches,
    fan: {
      averageRating: averageRating(playerRatings),
      pogCount: playerFanPogSetIds.size,
      reviews,
      ...(paginatedReviews ? { reviewNextCursor: reviewPage.nextCursor ? JSON.stringify(reviewPage.nextCursor) : null } : {}),
    },
  };
}
