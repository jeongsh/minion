import { NextResponse } from "next/server";

import { getAllTeams, getMatches, getSets } from "@/lib/data/lck";
import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { isMatchLive } from "@/lib/match-display";
import type { MatchActivityResponse, MatchActivityTeam } from "@/lib/match-activity";
import { getSetRatingStartedAt, SET_RATING_OPEN_WINDOW_MS } from "@/lib/set-status";
import type { Team } from "@/lib/types";
import { matchHref, setRatingHref } from "@/lib/view-data";

export const dynamic = "force-dynamic";

function activityTeam(team: Team | undefined, fallbackId: string): MatchActivityTeam {
  return {
    id: team?.id ?? fallbackId,
    name: team?.name ?? "미정 팀",
    shortName: team?.shortName ?? "TBD",
    logoUrl: team?.logoUrl ?? null,
  };
}

export async function GET() {
  const followedKeys = await getFollowedTeamIds();
  const [teams, matches, sets] = await Promise.all([getAllTeams(), getMatches(), getSets()]);
  const followedKeySet = new Set(followedKeys);
  const followedTeamIds = new Set(
    teams
      .filter((team) => followedKeySet.has(team.id) || followedKeySet.has(team.fanSiteHost))
      .map((team) => team.id),
  );
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const followedMatches = matches.filter(
    (match) => followedTeamIds.has(match.teamAId) || followedTeamIds.has(match.teamBId),
  );
  const followedMatchIds = new Set(followedMatches.map((match) => match.id));
  const setsByMatch = new Map<string, typeof sets>();

  for (const set of sets) {
    setsByMatch.set(set.matchId, [...(setsByMatch.get(set.matchId) ?? []), set]);
  }

  const now = Date.now();
  const liveMatches = matches
    .filter((match) => isMatchLive(match))
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    .map((match) => {
      const matchSets = (setsByMatch.get(match.id) ?? []).sort((a, b) => a.setNumber - b.setNumber);
      const activeSet = matchSets.find((set) => set.status === "draft_in_progress" || set.status === "draft_done");
      const scoreBasedSetNumber = Math.min(
        (match.teamAScore ?? 0) + (match.teamBScore ?? 0) + 1,
        match.bestOf ?? Number.POSITIVE_INFINITY,
      );

      return {
        id: match.id,
        href: `${matchHref(match)}?tab=live`,
        teamA: activityTeam(teamById.get(match.teamAId), match.teamAId),
        teamB: activityTeam(teamById.get(match.teamBId), match.teamBId),
        teamAScore: match.teamAScore,
        teamBScore: match.teamBScore,
        currentSetNumber: activeSet?.setNumber ?? (Number.isFinite(scoreBasedSetNumber) ? scoreBasedSetNumber : null),
      };
    });

  const matchById = new Map(followedMatches.map((match) => [match.id, match]));
  const ratings = sets
    .filter((set) => followedMatchIds.has(set.matchId))
    .flatMap((set) => {
      const startedAt = getSetRatingStartedAt(set);
      const match = matchById.get(set.matchId);
      if (startedAt === null || !match) return [];

      const closesAt = startedAt + SET_RATING_OPEN_WINDOW_MS;
      if (now < startedAt || now > closesAt) return [];

      return [{
        id: set.id,
        matchId: match.id,
        href: setRatingHref(match, set),
        setNumber: set.setNumber,
        closesAt: new Date(closesAt).toISOString(),
        teamA: activityTeam(teamById.get(match.teamAId), match.teamAId),
        teamB: activityTeam(teamById.get(match.teamBId), match.teamBId),
      }];
    })
    .sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime());

  return NextResponse.json<MatchActivityResponse>(
    { liveMatches, ratings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
