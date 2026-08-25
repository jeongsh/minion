import type { MobilePlayersDto } from "@/packages/contracts/src/mobile-v1";
import { getChallengersPlayers, getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";

export const revalidate = 21600;

export async function GET() {
  const [players, challengersPlayers, teams] = await Promise.all([
    getPlayers(),
    getChallengersPlayers(),
    getTeamsSortedByRank(),
  ]);
  const teamIds = new Set(teams.map((team) => team.id));
  const toDirectoryItem = (player: (typeof players)[number]) => ({
    id: player.id,
    isStarter: player.isStarter ?? false,
    name: player.name,
    position: player.position,
    profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null,
    realName: player.realName,
    slug: player.slug,
    teamId: player.teamId,
  });
  const data: MobilePlayersDto = {
    challengersItems: challengersPlayers.filter((player) => teamIds.has(player.teamId)).map(toDirectoryItem),
    items: players.filter((player) => teamIds.has(player.teamId)).map(toDirectoryItem),
    teams: teams.map(toMobileTeam),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400" } });
}
