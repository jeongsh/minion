import type { MobilePlayersDto } from "@/packages/contracts/src/mobile-v1";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";

export const revalidate = 21600;

export async function GET() {
  const [players, teams] = await Promise.all([getPlayers(), getTeamsSortedByRank()]);
  const teamIds = new Set(teams.map((team) => team.id));
  const data: MobilePlayersDto = {
    items: players.filter((player) => teamIds.has(player.teamId)).map((player) => ({ id: player.id, name: player.name, position: player.position, profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null, slug: player.slug, teamId: player.teamId })),
    teams: teams.map(toMobileTeam),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400" } });
}
