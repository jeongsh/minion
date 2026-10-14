import { getAllTeams, getPlayers } from "@/lib/data/lck";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferSeason } from "@/lib/transfers/types";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";
import type { MobileTransfersDto } from "@/packages/contracts/src/mobile-v1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = Number(new URL(request.url).searchParams.get("season"));
  const season = Number.isInteger(requested) && requested >= 2026 && requested <= transferSeason() ? requested : transferSeason();
  const [market, teams, players] = await Promise.all([getTransferMarket(season), getAllTeams(), getPlayers()]);
  const data: MobileTransfersDto = { market, teams: teams.map(toMobileTeam), players: players.map(({ name, slug }) => ({ name, slug })) };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
