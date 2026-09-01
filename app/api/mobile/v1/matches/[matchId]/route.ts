import type { MobileMatchDetailDto, MobileSetDetail } from "@/packages/contracts/src/mobile-v1";
import {
  getAllTeams,
  getAllPlayers,
  getChampions,
  getFanRatingsByMatchId,
  getMatchById,
  getMatches,
  getMatchVodsByMatchId,
  getPlayerStatLines,
  getSetPicksBans,
  getSetsByMatchId,
  getSets,
  getStages,
  getTimelineEvents,
  getTimelineFrames,
  getTournaments,
} from "@/lib/data/lck";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import { championImage } from "@/lib/champions";
import { isMatchLive, matchStatusLabel } from "@/lib/match-display";
import { getMatchAiPreview } from "@/lib/match-preview-ai";
import { getPredictionMarketData, predictionMarketForMatch } from "@/lib/predictions";
import { fanRatingLeader } from "@/lib/view-data";
import { getSetRatingStartedAt, isSetRatingOpen, isSetRatingSnapshotReady } from "@/lib/set-status";
import {
  mobileError,
  mobileSuccess,
  toMobileMatch,
  toMobileObjectiveCounts,
  toMobileSetDraftSide,
  toMobileSetPlayerStat,
  toMobileTeam,
  toMobileTimelineEvent,
  toMobileTimelineFrame,
} from "@/lib/mobile/api-response";
import { fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
import type { Team } from "@/lib/types";
import { getMobileAuth } from "@/lib/mobile/auth";
import { compactMatchStageName, compactMatchTournamentName } from "@/lib/match-header-labels";

const POSITION_ORDER = new Map(["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [position, index]));

function completedBefore(matches: Awaited<ReturnType<typeof getMatches>>, currentMatch: NonNullable<Awaited<ReturnType<typeof getMatchById>>>) {
  const currentTime = new Date(currentMatch.matchDate).getTime();
  return matches
    .filter((item) => item.id !== currentMatch.id && item.status === "completed" && new Date(item.matchDate).getTime() < currentTime)
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
}

function recentRecord(matches: Awaited<ReturnType<typeof getMatches>>, teamId: string) {
  const recent = matches.filter((item) => item.teamAId === teamId || item.teamBId === teamId).slice(0, 5);
  const wins = recent.filter((item) => item.winnerTeamId === teamId).length;
  return recent.length > 0 ? `${wins}-${recent.length - wins}` : "-";
}

function recentSetMetrics(
  sets: Awaited<ReturnType<typeof getSets>>,
  matches: Awaited<ReturnType<typeof getMatches>>,
  teamId: string,
) {
  const recentMatches = matches.filter((item) => item.teamAId === teamId || item.teamBId === teamId).slice(0, 5);
  const recentIds = new Set(recentMatches.map((item) => item.id));
  const teamSets = sets.filter((set) => recentIds.has(set.matchId) && (set.blueTeamId === teamId || set.redTeamId === teamId));
  const score = recentMatches.reduce((total, item) => {
    total.wins += (item.teamAId === teamId ? item.teamAScore : item.teamBScore) ?? 0;
    total.losses += (item.teamAId === teamId ? item.teamBScore : item.teamAScore) ?? 0;
    return total;
  }, { losses: 0, wins: 0 });
  const kills = teamSets.reduce((sum, set) => sum + ((set.blueTeamId === teamId ? set.blueKills : set.redKills) ?? 0), 0);
  return { averageKills: teamSets.length > 0 ? kills / teamSets.length : null, setDiff: score.wins - score.losses };
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params;
  const requestedSetId = new URL(request.url).searchParams.get("set");
  const [match, auth] = await Promise.all([getMatchById(matchId), getMobileAuth(request)]);
  if (!match) return mobileError("NOT_FOUND", "경기를 찾을 수 없습니다.", 404);

  const [teams, players, tournaments, stages, sets, vods, fanRatings, predictionData, allMatches, allSets] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getTournaments(),
    getStages(),
    getSetsByMatchId(match.id),
    getMatchVodsByMatchId(match.id),
    getFanRatingsByMatchId(match.id),
    getPredictionMarketData(undefined, match.id),
    getMatches(),
    getSets(),
  ]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  const stage = stages.find((item) => item.id === match.stageId);
  const pomPlayer = players.find((item) => item.id === match.officialPomPlayerId);

  const requestedSet = sets.find((set) => set.id === requestedSetId || String(set.setNumber) === requestedSetId);
  const defaultSet = requestedSet ?? sets.find((set) => set.setNumber === 1) ?? sets[0];

  const priorMatches = completedBefore(allMatches, match);
  const h2h = priorMatches
    .filter((item) =>
      (item.teamAId === match.teamAId && item.teamBId === match.teamBId) ||
      (item.teamAId === match.teamBId && item.teamBId === match.teamAId),
    )
    .slice(0, 5);
  const teamAMetrics = recentSetMetrics(allSets, priorMatches, match.teamAId);
  const teamBMetrics = recentSetMetrics(allSets, priorMatches, match.teamBId);
  const aiPreview = await getMatchAiPreview({ match, tournament, teams, matches: allMatches, sets: allSets, tournaments });
  const prediction = predictionMarketForMatch(predictionData.bets, match.id, match.teamAId, match.teamBId);

  let activeSet: MobileSetDetail | null = null;
  let fanRating: MobileMatchDetailDto["fanRating"] = null;
  const detailPlayerIds = new Set<string>();
  if (defaultSet) {
    const [picksBans, statLines, timelineEvents, timelineFrames, champions] = await Promise.all([
      getSetPicksBans(defaultSet.id),
      getPlayerStatLines(defaultSet.id),
      getTimelineEvents(defaultSet.id),
      getTimelineFrames(defaultSet.id),
      getChampions(),
    ]);
    const itemVersion = ddragonVersionFromPatch(defaultSet.patch);
    statLines.forEach((line) => detailPlayerIds.add(line.playerId));
    const [spells, runeCatalog] = await Promise.all([fetchSpellCatalog(itemVersion), fetchRuneCatalog(itemVersion)]);
    const teamFor = (id: string): Team | undefined => teamMap.get(id);
    const blueLines = statLines.filter((line) => line.teamId === defaultSet.blueTeamId);
    const redLines = statLines.filter((line) => line.teamId === defaultSet.redTeamId);
    const blueKills = defaultSet.blueKills ?? (blueLines.length === 5 ? blueLines.reduce((sum, line) => sum + line.kills, 0) : null);
    const redKills = defaultSet.redKills ?? (redLines.length === 5 ? redLines.reduce((sum, line) => sum + line.kills, 0) : null);
    const banItems = (side: "blue" | "red") =>
      picksBans.filter((item) => item.side === side && item.actionType === "ban");

    activeSet = {
      blueGold: defaultSet.blueGold,
      blueKills,
      blueObjectives: toMobileObjectiveCounts(defaultSet, "blue"),
      blueTeam: teamFor(defaultSet.blueTeamId) ? toMobileTeam(teamFor(defaultSet.blueTeamId)!) : null,
      blueTeamId: defaultSet.blueTeamId,
      draft:
        picksBans.length > 0
          ? {
              blue: toMobileSetDraftSide(defaultSet.blueTeamId, teamFor(defaultSet.blueTeamId)?.shortName ?? "블루", banItems("blue"), champions),
              red: toMobileSetDraftSide(defaultSet.redTeamId, teamFor(defaultSet.redTeamId)?.shortName ?? "레드", banItems("red"), champions),
            }
          : null,
      durationSeconds: defaultSet.durationSeconds,
      hasPickBan: picksBans.length > 0,
      id: defaultSet.id,
      playerStats: statLines.map((line) => toMobileSetPlayerStat(line, players, champions, spells, itemVersion, runeCatalog)),
      redGold: defaultSet.redGold,
      redKills,
      redObjectives: toMobileObjectiveCounts(defaultSet, "red"),
      redTeam: teamFor(defaultSet.redTeamId) ? toMobileTeam(teamFor(defaultSet.redTeamId)!) : null,
      redTeamId: defaultSet.redTeamId,
      setNumber: defaultSet.setNumber,
      timelineEvents: timelineEvents.map(toMobileTimelineEvent),
      timelineFrames: timelineFrames.map(toMobileTimelineFrame),
      winnerTeamId: defaultSet.winnerTeamId,
    };

    const setRatings = fanRatings.filter((rating) => rating.setId === defaultSet.id);
    const leader = defaultSet.winnerTeamId
      ? fanRatingLeader(setRatings.filter((rating) => rating.teamId === defaultSet.winnerTeamId))
      : null;
    const ratingOpen = isSetRatingOpen(defaultSet);
    const ratingStartedAt = getSetRatingStartedAt(defaultSet);
    const sortedLines = [...statLines].sort((a, b) => {
      if (a.teamId !== b.teamId) return a.teamId === defaultSet.blueTeamId ? -1 : 1;
      return (POSITION_ORDER.get(a.position) ?? 99) - (POSITION_ORDER.get(b.position) ?? 99);
    });
    fanRating = {
      comments: setRatings
        .filter((rating) => rating.review)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100)
        .map((rating) => {
          const player = players.find((item) => item.id === rating.playerId);
          return {
            authorImage: rating.authorProfileImageUrl ? { url: rating.authorProfileImageUrl } : null,
            authorName: rating.authorNickname ?? "익명",
            authorTier: rating.authorTier,
            dislikeCount: rating.dislikeCount,
            honorCount: rating.honorCount,
            id: rating.id,
            playerId: rating.playerId,
            playerImage: player?.profileImageUrl ? { url: player.profileImageUrl } : null,
            playerName: player?.name ?? "-",
            rating: rating.rating,
            review: rating.review,
          };
        }),
      players: sortedLines.map((line) => {
        const player = players.find((item) => item.id === line.playerId);
        const champion = champions.find((item) => item.id === line.championId);
        const ratings = setRatings.filter((rating) => rating.playerId === line.playerId);
        const total = ratings.reduce((sum, rating) => sum + rating.rating, 0);
        return {
          averageRating: ratings.length > 0 ? total / ratings.length : null,
          champion: champion ? { id: champion.id, image: championImage(champion) ? { url: championImage(champion) } : null, name: champion.name } : null,
          id: line.playerId,
          isPog: leader?.playerId === line.playerId,
          name: player?.name ?? "-",
          myRating: auth ? ratings.find((rating) => rating.authorId === auth.user.id)?.rating ?? null : null,
          position: line.position,
          profileImage: player?.profileImageUrl ? { url: player.profileImageUrl } : null,
          ratingCount: ratings.length,
          team: teamMap.get(line.teamId) ? toMobileTeam(teamMap.get(line.teamId)!) : null,
        };
      }),
      ratingOpen,
      snapshotAvailable: isSetRatingSnapshotReady(defaultSet),
      statusNote: ratingOpen && ratingStartedAt !== null
        ? "평점 입력이 열렸습니다. 종료 기한은 없습니다."
        : "세트 상태가 경기종료 또는 상세데이터 동기화일 때 투표가 열립니다.",
    };
  }

  const data: MobileMatchDetailDto = {
    activeSet,
    activeSetId: defaultSet?.id ?? null,
    fanRating,
    header: {
      bestOf: match.bestOf ?? null,
      pomPlayer: pomPlayer
        ? { id: pomPlayer.id, name: pomPlayer.name, position: pomPlayer.position, profileImage: pomPlayer.profileImageUrl ? { url: pomPlayer.profileImageUrl } : null, slug: pomPlayer.slug, teamId: pomPlayer.teamId }
        : null,
      stageName: compactMatchStageName(stage?.name ?? "스테이지 미지정"),
      statusLabel: matchStatusLabel(isMatchLive(match) ? "live" : match.status),
      tournamentName: compactMatchTournamentName(tournament?.name ?? "대회 미지정"),
    },
    live: { available: match.status === "live", pollingIntervalMs: 5000 },
    match: toMobileMatch(match, teamMap, tournamentMap),
    matchVodUrl: match.vodUrl ?? null,
    players: players
      .filter((player) => detailPlayerIds.has(player.id) || player.id === match.officialPomPlayerId)
      .map((player) => ({ id: player.id, name: player.name, position: player.position, profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null, slug: player.slug, teamId: player.teamId })),
    preview: {
      ai: {
        generatedAt: aiPreview.generatedAt,
        generationPhase: aiPreview.generationPhase,
        headline: aiPreview.headline,
        liveCheck: aiPreview.liveCheck,
        matchMeaning: aiPreview.matchMeaning,
        narrative: aiPreview.narrative
          ? {
              body: aiPreview.narrative.body,
              tags: aiPreview.narrative.tags,
              title: aiPreview.narrative.title,
            }
          : null,
        recentView: aiPreview.recentView
          ? {
              asOf: aiPreview.recentView.asOf,
              body: aiPreview.recentView.body,
              title: aiPreview.recentView.title,
            }
          : null,
        sources: aiPreview.sources,
        summary: aiPreview.summary,
        teamAWinCondition: aiPreview.teamAWinCondition,
        teamBWinCondition: aiPreview.teamBWinCondition,
        watchPoint: aiPreview.watchPoint,
        winProbabilityA: aiPreview.winProbabilityA,
      },
      meetings: h2h.map((item) => toMobileMatch(item, teamMap, tournamentMap)),
      metrics: {
        averageKillsA: teamAMetrics.averageKills,
        averageKillsB: teamBMetrics.averageKills,
        recentRecordA: recentRecord(priorMatches, match.teamAId),
        recentRecordB: recentRecord(priorMatches, match.teamBId),
        setDiffA: teamAMetrics.setDiff,
        setDiffB: teamBMetrics.setDiff,
      },
      prediction: {
        closed: match.status !== "scheduled" || new Date(match.matchDate).getTime() <= Date.now(),
        teamAOdds: prediction.teamAOdds,
        teamAPercent: prediction.teamAPercent,
        teamBOdds: prediction.teamBOdds,
        teamBPercent: prediction.teamBPercent,
      },
    },
    sets: sets.map((set) => ({ durationSeconds: set.durationSeconds, id: set.id, setNumber: set.setNumber, status: set.status, winnerTeamId: set.winnerTeamId })),
    vods: vods.map((vod, index) => ({ channelName: vod.provider, embedUrl: vod.embedUrl ?? null, id: `${match.id}-${vod.setNumber}-${index}`, publishedAt: null, thumbnail: vod.thumbnailUrl ? { url: vod.thumbnailUrl } : null, title: `${vod.setNumber}세트 다시보기`, url: vod.url })),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": auth || match.status === "live" ? "private, no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
