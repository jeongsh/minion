import type { MobileSearchDto, MobileSearchResult } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getMatches, getPlayers, getTeamsSortedByRank, getTournaments } from "@/lib/data/lck";
import { mobileSuccess } from "@/lib/mobile/api-response";

export const revalidate = 30;

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return mobileSuccess<MobileSearchDto>({ query, results: [] });
  const normalized = normalize(query);
  const [teams, allTeams, players, tournaments, matches] = await Promise.all([getTeamsSortedByRank(), getAllTeams(), getPlayers(), getTournaments(), getMatches()]);
  const allTeamMap = new Map(allTeams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const includes = (...values: Array<string | null | undefined>) => values.some((value) => normalize(value ?? "").includes(normalized));
  const results: MobileSearchResult[] = [
    ...teams.filter((team) => includes(team.name, team.shortName, team.slug, team.fanSiteHost, ...(team.searchAliases ?? []))).slice(0, 5).map((team) => ({ href: `/fan/${team.fanSiteHost}`, image: team.logoUrl ? { url: team.logoUrl } : null, subtitle: `팀 · ${team.shortName}`, title: team.name, type: "team" as const })),
    ...players.filter((player) => includes(player.name, player.realName, player.slug, ...(player.searchAliases ?? []))).slice(0, 8).map((player) => ({ href: `/players/${player.slug}`, image: player.profileImageUrl ? { url: player.profileImageUrl } : null, subtitle: `선수 · ${allTeamMap.get(player.teamId)?.shortName ?? "FA"}`, title: player.name, type: "player" as const })),
    ...matches.filter((match) => {
      const teamA = allTeamMap.get(match.teamAId);
      const teamB = allTeamMap.get(match.teamBId);
      const tournament = tournamentMap.get(match.tournamentId);
      return includes(match.name, teamA?.name, teamA?.shortName, teamB?.name, teamB?.shortName, tournament?.name);
    }).slice(0, 6).map((match) => ({ href: `/matches/${encodeURIComponent(match.id)}`, image: null, subtitle: `경기 · ${tournamentMap.get(match.tournamentId)?.name ?? match.name}`, title: `${allTeamMap.get(match.teamAId)?.shortName ?? "TBD"} vs ${allTeamMap.get(match.teamBId)?.shortName ?? "TBD"}`, type: "match" as const })),
    ...tournaments.filter((tournament) => includes(tournament.name, tournament.league, tournament.split, String(tournament.season))).slice(0, 5).map((tournament) => ({ href: "/tournaments", image: null, subtitle: `대회 · ${tournament.season}`, title: tournament.name, type: "tournament" as const })),
  ];
  return mobileSuccess<MobileSearchDto>({ query, results }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
