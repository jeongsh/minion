import type { MobileTournamentsDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getMatches, getTournaments } from "@/lib/data/lck";
import { mobileSuccess, toMobileMatch, toMobileTournament } from "@/lib/mobile/api-response";

export const revalidate = 300;

export async function GET() {
  const [teams, tournaments, matches] = await Promise.all([getAllTeams(), getTournaments(), getMatches()]);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const data: MobileTournamentsDto = {
    items: [...tournaments].sort((a, b) => b.season - a.season || a.name.localeCompare(b.name)).map(toMobileTournament),
    matches: matches.map((match) => toMobileMatch(match, teamMap, tournamentMap)),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
}
