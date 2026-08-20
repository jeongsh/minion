import type { MobileTeamsDto } from "@/packages/contracts/src/mobile-v1";
import { getTeamsSortedByRank } from "@/lib/data/lck";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";

export const revalidate = 21600;

export async function GET() {
  const teams = await getTeamsSortedByRank();
  const data: MobileTeamsDto = { items: teams.map(toMobileTeam) };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400" } });
}
