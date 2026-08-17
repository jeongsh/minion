import { NextResponse } from "next/server";

import { getAllTeams, getMatches, getPlayers, getTeamsSortedByRank, getTournaments } from "@/lib/data/lck";
import {
  DOMESTIC_SEGMENTS,
  INTERNATIONAL_SEGMENTS,
} from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import { formatDateTime, matchHref } from "@/lib/view-data";

const ALL_SEGMENTS = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];
const MIN_SEARCH_LENGTH = 2;

export const dynamic = "force-dynamic";

export type SearchResultType = "team" | "player" | "match" | "tournament";

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

function matchesFields(fields: Array<string | null | undefined>, rawQuery: string) {
  const normalizedFields = fields.map((field) => normalize(field ?? "")).filter(Boolean);
  const normalizedQuery = normalize(rawQuery);
  if (normalizedFields.some((field) => field.includes(normalizedQuery))) return true;

  const tokens = rawQuery.split(/\s+/).map(normalize).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) =>
    normalizedFields.some((field) => field.includes(token)),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();

  if (raw.length < MIN_SEARCH_LENGTH) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  const query = normalize(raw);

  const [teams, allTeams, players, tournaments, matches] = await Promise.all([
    getTeamsSortedByRank(),
    getAllTeams(),
    getPlayers(),
    getTournaments(),
    getMatches(),
  ]);

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

  const matchStatusOrder = { live: 0, scheduled: 1, completed: 2 } as const;
  const matchResults: SearchResult[] = matches
    .filter((match) => {
      const teamA = allTeamById.get(match.teamAId);
      const teamB = allTeamById.get(match.teamBId);
      const tournament = tournamentById.get(match.tournamentId);
      return matchesFields([
        match.name,
        match.matchDate,
        formatDateTime(match.matchDate),
        teamA?.name,
        teamA?.shortName,
        teamA?.slug,
        ...(teamA?.searchAliases ?? []),
        teamB?.name,
        teamB?.shortName,
        teamB?.slug,
        ...(teamB?.searchAliases ?? []),
        tournament?.name,
        tournament?.category,
        tournament?.split,
        tournament?.league,
      ], raw);
    })
    .sort((a, b) => {
      const statusDifference = matchStatusOrder[a.status] - matchStatusOrder[b.status];
      if (statusDifference !== 0) return statusDifference;
      const dateDifference = new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
      return a.status === "completed" ? -dateDifference : dateDifference;
    })
    .slice(0, 6)
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
    ...matchResults,
    ...tournamentResults.slice(0, 4),
  ];

  return NextResponse.json({ results });
}
