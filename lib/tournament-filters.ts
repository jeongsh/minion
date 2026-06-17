import type { Match, SetResult, Tournament } from "@/lib/types";
import {
  parseSeasonSegment,
  segmentForTournament,
  segmentLabel,
  tournamentIdsForSegment,
  type SeasonSegmentKey,
} from "@/lib/tournaments/season-2026";

export { parseSeasonSegment, segmentLabel, type SeasonSegmentKey };

export function filterMatchesBySegment(
  matches: Match[],
  tournaments: Tournament[],
  segment: SeasonSegmentKey | "all",
  seasonYear?: number,
) {
  const tournamentIds = tournamentIdsForSegment(tournaments, segment, seasonYear);

  return matches.filter((match) => tournamentIds.has(match.tournamentId));
}

export function filterSetsByMatches(sets: SetResult[], matches: Match[]) {
  const matchIds = new Set(matches.map((match) => match.id));
  return sets.filter((set) => matchIds.has(set.matchId));
}

export function tournamentsInSegment(
  tournaments: Tournament[],
  segment: SeasonSegmentKey | "all",
  seasonYear?: number,
) {
  if (segment === "all") {
    return seasonYear == null
      ? tournaments
      : tournaments.filter((tournament) => tournament.season === seasonYear);
  }

  return tournaments.filter(
    (tournament) =>
      (seasonYear == null || tournament.season === seasonYear) &&
      segmentForTournament(tournament) === segment,
  );
}

export function filterStatLinesByMatchIds<T extends { setId: string }>(
  lines: T[],
  sets: SetResult[],
  matches: Match[],
) {
  const scopedSets = filterSetsByMatches(sets, matches);
  const setIds = new Set(scopedSets.map((set) => set.id));
  return lines.filter((line) => setIds.has(line.setId));
}

export function filterPicksBansByMatches<T extends { setId: string }>(
  picksBans: T[],
  sets: SetResult[],
  matches: Match[],
) {
  return filterStatLinesByMatchIds(picksBans, sets, matches);
}
