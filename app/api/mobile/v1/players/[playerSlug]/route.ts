import type { MobilePlayerDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getPlayerBySlug, getPlayerCareerHistories, getTeamById } from "@/lib/data/lck";
import { mobileError, mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";

export const revalidate = 300;

export async function GET(_: Request, context: { params: Promise<{ playerSlug: string }> }) {
  const { playerSlug } = await context.params;
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return mobileError("NOT_FOUND", "선수를 찾을 수 없습니다.", 404);
  const [team, career] = await Promise.all([getTeamById(player.teamId), getPlayerCareerHistories([player.id])]);
  const data: MobilePlayerDetailDto = {
    career: career.map((item) => ({ endDate: item.endDate, id: item.id, position: item.position, startDate: item.startDate, teamId: item.teamId, teamName: item.teamName })),
    player: { id: player.id, name: player.name, position: player.position, profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null, slug: player.slug, teamId: player.teamId },
    team: team ? toMobileTeam(team) : null,
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
}
