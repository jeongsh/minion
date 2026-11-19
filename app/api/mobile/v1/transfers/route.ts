import { getAllTeams, getPlayers } from "@/lib/data/lck";
import { getTransferMarket } from "@/lib/transfers/data";
import { transferSeason, type TransferEvent } from "@/lib/transfers/types";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";
import type { MobileTransfersDto } from "@/packages/contracts/src/mobile-v1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = Number(params.get("season"));
  const season = Number.isInteger(requested) && requested >= 2026 && requested <= transferSeason() ? requested : transferSeason();
  const [market, teams, players] = await Promise.all([getTransferMarket(season), getAllTeams(), getPlayers()]);
  // Installed app versions without the return kind can still resolve it as a signing.
  const legacyEvent = (event: TransferEvent): TransferEvent => event.kind === "return"
    ? { ...event, kind: "transfer" }
    : event;
  const compatibleMarket = market && params.get("returnKind") !== "1" ? {
    ...market,
    snapshot: { ...market.snapshot, events: market.snapshot.events.map(legacyEvent) },
    manual_events: market.manual_events.map(legacyEvent),
  } : market;
  const data: MobileTransfersDto = { market: compatibleMarket, teams: teams.map(toMobileTeam), players: players.map(({ name, slug }) => ({ name, slug })) };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
