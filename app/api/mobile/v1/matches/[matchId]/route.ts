import type { MobileMatchDetailDto, MobileSetDetail } from "@/packages/contracts/src/mobile-v1";
import {
  getAllTeams,
  getChampions,
  getMatchById,
  getMatchVodsByMatchId,
  getPlayerStatLines,
  getPlayersByTeamId,
  getSetPicksBans,
  getSetsByMatchId,
  getStages,
  getTimelineEvents,
  getTimelineFrames,
  getTournaments,
} from "@/lib/data/lck";
import { ddragonVersionFromPatch } from "@/lib/ddragon";
import { isMatchLive, matchStatusLabel } from "@/lib/match-display";
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

export const revalidate = 30;

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params;
  const requestedSetId = new URL(request.url).searchParams.get("set");
  const match = await getMatchById(matchId);
  if (!match) return mobileError("NOT_FOUND", "경기를 찾을 수 없습니다.", 404);

  const [teams, tournaments, stages, sets, vods, teamAPlayers, teamBPlayers] = await Promise.all([
    getAllTeams(),
    getTournaments(),
    getStages(),
    getSetsByMatchId(match.id),
    getMatchVodsByMatchId(match.id),
    getPlayersByTeamId(match.teamAId),
    getPlayersByTeamId(match.teamBId),
  ]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const players = [...teamAPlayers, ...teamBPlayers];
  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  const stage = stages.find((item) => item.id === match.stageId);
  const pomPlayer = players.find((item) => item.id === match.officialPomPlayerId);

  const requestedSet = sets.find((set) => set.id === requestedSetId);
  const defaultSet = requestedSet ?? sets.find((set) => set.setNumber === 1) ?? sets[0];

  let activeSet: MobileSetDetail | null = null;
  if (defaultSet) {
    const [picksBans, statLines, timelineEvents, timelineFrames, champions] = await Promise.all([
      getSetPicksBans(defaultSet.id),
      getPlayerStatLines(defaultSet.id),
      getTimelineEvents(defaultSet.id),
      getTimelineFrames(defaultSet.id),
      getChampions(),
    ]);
    const itemVersion = ddragonVersionFromPatch(defaultSet.patch);
    const [spells, runeCatalog] = await Promise.all([fetchSpellCatalog(itemVersion), fetchRuneCatalog(itemVersion)]);
    const teamFor = (id: string): Team | undefined => teamMap.get(id);
    const banItems = (side: "blue" | "red") =>
      picksBans.filter((item) => item.side === side && item.actionType === "ban");

    activeSet = {
      blueGold: defaultSet.blueGold,
      blueKills: defaultSet.blueKills,
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
      redKills: defaultSet.redKills,
      redObjectives: toMobileObjectiveCounts(defaultSet, "red"),
      redTeam: teamFor(defaultSet.redTeamId) ? toMobileTeam(teamFor(defaultSet.redTeamId)!) : null,
      redTeamId: defaultSet.redTeamId,
      setNumber: defaultSet.setNumber,
      timelineEvents: timelineEvents.map(toMobileTimelineEvent),
      timelineFrames: timelineFrames.map(toMobileTimelineFrame),
      winnerTeamId: defaultSet.winnerTeamId,
    };
  }

  const data: MobileMatchDetailDto = {
    activeSet,
    activeSetId: defaultSet?.id ?? null,
    fanRating: null,
    header: {
      bestOf: match.bestOf ?? null,
      pomPlayer: pomPlayer
        ? { id: pomPlayer.id, name: pomPlayer.name, position: pomPlayer.position, profileImage: pomPlayer.profileImageUrl ? { url: pomPlayer.profileImageUrl } : null, slug: pomPlayer.slug, teamId: pomPlayer.teamId }
        : null,
      stageName: stage?.name ?? "스테이지 미지정",
      statusLabel: matchStatusLabel(isMatchLive(match) ? "live" : match.status),
      tournamentName: tournament?.name ?? "대회 미지정",
    },
    initialStats: null,
    live: { available: match.status === "live", pollingIntervalMs: 5000 },
    match: toMobileMatch(match, teamMap, tournamentMap),
    matchVodUrl: match.vodUrl ?? null,
    players: players.map((player) => ({ id: player.id, name: player.name, position: player.position, profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null, slug: player.slug, teamId: player.teamId })),
    prediction: null,
    sets: sets.map((set) => ({ durationSeconds: set.durationSeconds, id: set.id, setNumber: set.setNumber, status: set.status, winnerTeamId: set.winnerTeamId })),
    vods: vods.map((vod, index) => ({ channelName: vod.provider, id: `${match.id}-${vod.setNumber}-${index}`, publishedAt: null, thumbnail: vod.thumbnailUrl ? { url: vod.thumbnailUrl } : null, title: `${vod.setNumber}세트 다시보기`, url: vod.url })),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": match.status === "live" ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
