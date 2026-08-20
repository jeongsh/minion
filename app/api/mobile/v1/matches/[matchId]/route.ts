import type { MobileMatchDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getMatchById, getMatchVodsByMatchId, getPlayersByTeamId, getSetsByMatchId, getTournaments } from "@/lib/data/lck";
import { mobileError, mobileSuccess, toMobileMatch } from "@/lib/mobile/api-response";

export const revalidate = 30;

export async function GET(_: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params;
  const match = await getMatchById(matchId);
  if (!match) return mobileError("NOT_FOUND", "경기를 찾을 수 없습니다.", 404);
  const [teams, tournaments, sets, vods, teamAPlayers, teamBPlayers] = await Promise.all([
    getAllTeams(),
    getTournaments(),
    getSetsByMatchId(match.id),
    getMatchVodsByMatchId(match.id),
    getPlayersByTeamId(match.teamAId),
    getPlayersByTeamId(match.teamBId),
  ]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const data: MobileMatchDetailDto = {
    fanRating: null,
    initialStats: null,
    live: { available: match.status === "live", pollingIntervalMs: 5000 },
    match: toMobileMatch(match, teamMap, tournamentMap),
    players: [...teamAPlayers, ...teamBPlayers].map((player) => ({ id: player.id, name: player.name, position: player.position, profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null, slug: player.slug, teamId: player.teamId })),
    prediction: null,
    sets: sets.map((set) => ({ durationSeconds: set.durationSeconds, id: set.id, setNumber: set.setNumber, status: set.status, winnerTeamId: set.winnerTeamId })),
    vods: vods.map((vod, index) => ({ channelName: vod.provider, id: `${match.id}-${vod.setNumber}-${index}`, publishedAt: null, thumbnail: vod.thumbnailUrl ? { url: vod.thumbnailUrl } : null, title: `${vod.setNumber}세트 다시보기`, url: vod.url })),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": match.status === "live" ? "no-store" : "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
