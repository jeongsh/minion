import type { MobilePlayerDetailDto } from "@/packages/contracts/src/mobile-v1";
import { championImage, championLabel } from "@/lib/champions";
import {
  getPlayerBySlug,
  getPlayerStatLines,
} from "@/lib/data/lck";
import {
  getPlayerPageSegmentData,
  getPlayerPageSharedData,
} from "@/lib/data/player-cache";
import { ddragonVersionFromPatch, uniqueDdragonVersionsForPatches } from "@/lib/ddragon";
import { toMobilePlayerLoadout, toMobileTeam } from "@/lib/mobile/api-response";
import { getPlayerSocialLinks } from "@/lib/player-social";
import { fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
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
} from "@/lib/tournament-filters";
import type { FanRating, Match, PlayerStatLine, SetResult, Tournament } from "@/lib/types";
import { fanPogPlayerIdForSet, setRatingHref } from "@/lib/view-data";

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

function averageRating(ratings: FanRating[]) {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
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

export async function getMobilePlayerDetail(
  playerSlug: string,
  requestedSegmentValue?: string | null,
): Promise<MobilePlayerDetailDto | null> {
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return null;

  const [sharedData, playerOwnLines] = await Promise.all([
    getPlayerPageSharedData(),
    // 이 선수 전체 스탯라인. 구간 탭 판단 + 아래 구간 필터 소스로 재사용한다.
    getPlayerStatLines(undefined, player.id),
  ]);
  const { teams, players, matches, sets, fanRatings, tournaments, champions, standings } = sharedData;
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
  const segmentSets = filterSetsByMatches(sets, segmentMatches);
  const segmentSetIds = segmentSets.map((set) => set.id);
  // 이 선수의 구간 스탯라인은 이미 받아온 playerOwnLines 에서 걸러 쓴다(중복 쿼리 제거).
  const segmentSetIdSet = new Set(segmentSetIds);
  const playerSegmentLines = playerOwnLines.filter((line) => segmentSetIdSet.has(line.setId));
  const segmentData = segmentSetIds.length
    ? await getPlayerPageSegmentData(segmentSetIds)
    : { radarBenchmarkByPosition: {}, pickBanByChampion: {}, mainUserIdsByChampion: {} };
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
  const playerRatings = fanRatings.filter(
    (rating) => playerLines.some((line) => line.setId === rating.setId) && rating.playerId === player.id,
  );
  const playerFanPogSetIds = new Set(
    playerLines
      .filter((line) => fanPogPlayerIdForSet(line.setId, line.set.winnerTeamId, fanRatings) === player.id)
      .map((line) => line.setId),
  );
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

  const itemVersions = uniqueDdragonVersionsForPatches(playerLines.map((line) => line.set.patch));
  const versionedAssets = await Promise.all(itemVersions.map(async (version) => {
    const [spells, runeCatalog] = await Promise.all([fetchSpellCatalog(version), fetchRuneCatalog(version)]);
    return [version, { spells, runeCatalog }] as const;
  }));
  const assetsByVersion = Object.fromEntries(versionedAssets);

  const championRows = [...new Set(playerLines.map((line) => line.championId).filter(Boolean) as string[])]
    .map((championId) => {
      const champion = champions.find((item) => item.id === championId);
      const lines = playerLines.filter((line) => line.championId === championId);
      const stats = aggregateLines(lines);
      const championWins = lines.filter((line) => line.set.winnerTeamId === player.teamId).length;
      const championRatings = fanRatings.filter(
        (rating) => rating.playerId === player.id && lines.some((line) => line.setId === rating.setId),
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

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const recentMatches = completedPlayerMatches.map((match) => {
    const lines = playerLines
      .filter((line) => line.match.id === match.id)
      .sort((a, b) => a.set.setNumber - b.set.setNumber);
    const playerTeamId = lines[0]?.teamId ?? player.teamId;
    const opponentId = match.teamAId === playerTeamId ? match.teamBId : match.teamAId;
    const opponent = teamById.get(opponentId);
    const matchRatings = fanRatings.filter(
      (rating) => rating.matchId === match.id && rating.playerId === player.id,
    );
    const officialPomName = players.find((item) => item.id === match.officialPomPlayerId)?.name ?? "-";
    return {
      id: match.id,
      name: match.name,
      startsAt: match.matchDate,
      playerTeamId,
      opponent: opponent ? toMobileTeam(opponent) : null,
      winnerTeamId: match.winnerTeamId ?? null,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      fanPog: lines.some((line) => playerFanPogSetIds.has(line.setId)),
      officialPomName,
      sets: lines.map((line) => {
        const version = ddragonVersionFromPatch(line.set.patch);
        const assets = assetsByVersion[version] ?? { spells: [], runeCatalog: { keystones: [], trees: [] } };
        const rating = matchRatings.find((item) => item.setId === line.setId);
        return {
          id: line.setId,
          setNumber: line.set.setNumber,
          rating: rating?.rating ?? null,
          championLevel: line.championLevel ?? null,
          kills: line.kills,
          deaths: line.deaths,
          assists: line.assists,
          kda: line.stats.kda,
          damage: line.damageToChampions,
          dpm: line.stats.dpm,
          visionScore: line.visionScore,
          cs: line.cs,
          csm: line.stats.csm,
          gold: line.gold,
          loadout: toMobilePlayerLoadout(line, champions, assets.spells, version, assets.runeCatalog),
        };
      }),
    };
  });

  const matchById = new Map(matches.map((match) => [match.id, match]));
  const setById = new Map(sets.map((set) => [set.id, set]));
  const reviews = playerRatings
    .filter((rating) => rating.review.trim())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((rating) => {
      const match = matchById.get(rating.matchId);
      const set = setById.get(rating.setId);
      return {
        id: rating.id,
        rating: rating.rating,
        review: rating.review,
        authorId: rating.authorId,
        authorName: rating.authorNickname ?? "익명",
        authorImage: rating.authorProfileImageUrl ? { url: rating.authorProfileImageUrl } : null,
        authorTier: rating.authorTier,
        meta: [
          formatReviewDate(rating.createdAt),
          match?.name,
          set ? `${set.setNumber}세트` : null,
        ].filter(Boolean).join(" · "),
        href: match && set ? setRatingHref(match, set) : null,
      };
    });

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
    },
  };
}
