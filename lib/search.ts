import { createSupabaseServerClient, canQuerySupabase } from "@/lib/supabase/server";
import { championImage } from "@/lib/champions";
import { getAllTeams, getChampions, getMatchesForScope, getPlayers, getTeamsSortedByRank, getTournaments } from "@/lib/data/lck";
import {
  DOMESTIC_SEGMENTS,
  INTERNATIONAL_SEGMENTS,
} from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import { formatDateTime, matchHref } from "@/lib/view-data";

const ALL_SEGMENTS = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];
const MIN_SEARCH_LENGTH = 2;

export type SearchResultType = "team" | "player" | "champion" | "match" | "tournament";

export type SearchResult = {
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
  imageUrl?: string | null;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function normalizeChampionSearch(value: string) {
  return normalize(value).replace(/[.'’_-]/g, "");
}

export async function getSearchResults(rawQuery: string): Promise<SearchResult[]> {
  const raw = rawQuery.trim();

  if (raw.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const query = normalize(raw);

  const [teams, allTeams, players, champions, tournaments, matchedIds] = await Promise.all([
    getTeamsSortedByRank(),
    getAllTeams(),
    getPlayers(),
    getChampions(),
    getTournaments(),
    canQuerySupabase() ? createSupabaseServerClient().rpc("search_match_ids", { p_query: query, p_tokens: raw.split(/\s+/).map(normalize).filter(Boolean) }).then(({ data, error }) => { if (error) throw error; return (data ?? []) as { id: string }[]; }) : [],
  ]);

  const matchIds = matchedIds.map(row => row.id);
  const matches = await getMatchesForScope({ ids: matchIds });

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const allTeamById = new Map(allTeams.map((team) => [team.id, team]));
  const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));

  const teamResults: SearchResult[] = teams
    .filter((team) =>
      [
        team.name,
        team.shortName,
        team.slug,
        team.fanSiteHost,
        ...(team.searchAliases ?? []),
      ].some((field) => normalize(field ?? "").includes(query)),
    )
    .map((team) => ({
      type: "team" as const,
      title: team.name,
      subtitle: `팀 · ${team.shortName}`,
      href: `/fan/${team.fanSiteHost}`,
      imageUrl: team.logoUrl,
    }));

  const playerResults: SearchResult[] = players
    .filter((player) => player.teamId && teamById.has(player.teamId))
    .filter((player) =>
      [
        player.name,
        player.realName,
        player.slug,
        ...(player.searchAliases ?? []),
      ].some((field) => normalize(field ?? "").includes(query)),
    )
    .map((player) => {
      const team = player.teamId ? teamById.get(player.teamId) : null;
      return {
        type: "player" as const,
        title: player.name,
        subtitle: `선수 · ${team?.shortName ?? "FA"}${player.realName ? ` · ${player.realName}` : ""}`,
        href: `/players/${player.slug}`,
        imageUrl: player.profileImageUrl || null,
      };
    });

  const championQuery = normalizeChampionSearch(raw);
  const championResults: SearchResult[] = champions
    .filter((champion) =>
      [champion.name, champion.slug, champion.ddragonId].some((field) =>
        normalizeChampionSearch(field ?? "").includes(championQuery),
      ),
    )
    .map((champion) => ({
      type: "champion" as const,
      title: champion.name,
      subtitle: `챔피언 · ${champion.ddragonId ?? champion.slug}`,
      href: `/champions/${champion.slug}`,
      imageUrl: championImage(champion),
    }));

  const seenSegments = new Set<string>();
  const tournamentResults: SearchResult[] = [];
  for (const segment of ALL_SEGMENTS) {
    if (seenSegments.has(segment.key)) continue;
    const matched = tournaments.some((tournament) =>
      matchesTournamentSegment(tournament, segment.key),
    );
    if (!matched) continue;
    if (normalize(`${segment.name}${segment.description}${segment.key}`).includes(query)) {
      seenSegments.add(segment.key);
      tournamentResults.push({
        type: "tournament",
        title: segment.name,
        subtitle: `대회 · ${segment.description}`,
        href: `/tournaments/${segment.key}`,
        imageUrl: segment.logo ?? null,
      });
    }
  }

  const matchResults: SearchResult[] = matches
    .sort((a, b) => matchIds.indexOf(a.id) - matchIds.indexOf(b.id))
    .map((match) => {
      const teamA = allTeamById.get(match.teamAId);
      const teamB = allTeamById.get(match.teamBId);
      const tournament = tournamentById.get(match.tournamentId);
      const teamAName = teamA?.shortName || teamA?.name || "TBD";
      const teamBName = teamB?.shortName || teamB?.name || "TBD";
      return {
        type: "match" as const,
        title: `${teamAName} vs ${teamBName}`,
        subtitle: `경기 · ${tournament?.name ?? match.name} · ${formatDateTime(match.matchDate)}`,
        href: matchHref(match),
      };
    });

  const results = [
    ...teamResults.slice(0, 4),
    ...playerResults.slice(0, 6),
    ...championResults.slice(0, 6),
    ...matchResults,
    ...tournamentResults.slice(0, 4),
  ];

  return results;
}
