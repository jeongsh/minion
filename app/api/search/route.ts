import { NextResponse } from "next/server";

import { getPlayers, getTeamsSortedByRank, getTournaments } from "@/lib/data/lck";
import {
  DOMESTIC_SEGMENTS,
  INTERNATIONAL_SEGMENTS,
} from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";

const ALL_SEGMENTS = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];

export const dynamic = "force-dynamic";

export type SearchResultType = "team" | "player" | "tournament";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();

  if (raw.length === 0) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  const query = normalize(raw);

  const [teams, players, tournaments] = await Promise.all([
    getTeamsSortedByRank(),
    getPlayers(),
    getTournaments(),
  ]);

  const teamById = new Map(teams.map((team) => [team.id, team]));

  const teamResults: SearchResult[] = teams
    .filter((team) =>
      [team.name, team.shortName, team.slug, team.fanSiteHost].some((field) =>
        normalize(field ?? "").includes(query),
      ),
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
      [player.name, player.realName, player.slug].some((field) =>
        normalize(field ?? "").includes(query),
      ),
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
      });
    }
  }

  const results = [
    ...teamResults.slice(0, 4),
    ...playerResults.slice(0, 6),
    ...tournamentResults.slice(0, 4),
  ];

  return NextResponse.json({ results });
}
