import type { LolesportsEvent, LolesportsState, LolesportsTeam } from "./lolesports.ts";

export type LocalTeamIdentity = {
  id: string;
  name: string;
  shortName: string;
};

export type LocalMatchCandidate = {
  id: string;
  matchDate: string;
  lolesportsMatchId: string | null;
  teamA: LocalTeamIdentity;
  teamB: LocalTeamIdentity;
};

export type AlignedLolesportsMatch = {
  event: LolesportsEvent;
  lolesportsMatchId: string;
  state: LolesportsState;
  teamAScore: number;
  teamBScore: number;
  completedGameCount: number;
};

function normalizeTeamName(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function teamMatches(local: LocalTeamIdentity, external: LolesportsTeam) {
  const localKeys = new Set(
    [local.shortName, local.name].map(normalizeTeamName).filter(Boolean),
  );
  const exactMatch = [external.code, external.name]
    .map(normalizeTeamName)
    .some((key) => localKeys.has(key));
  if (exactMatch) return true;

  const localName = normalizeTeamName(local.name);
  const externalName = normalizeTeamName(external.name);
  return (
    Math.min(localName.length, externalName.length) >= 5 &&
    (localName.startsWith(externalName) || externalName.startsWith(localName))
  );
}

function alignEvent(local: LocalMatchCandidate, event: LolesportsEvent) {
  const [first, second] = event.matchTeams;
  if (teamMatches(local.teamA, first) && teamMatches(local.teamB, second)) {
    return { teamAScore: first.result.gameWins, teamBScore: second.result.gameWins };
  }
  if (teamMatches(local.teamA, second) && teamMatches(local.teamB, first)) {
    return { teamAScore: second.result.gameWins, teamBScore: first.result.gameWins };
  }
  return null;
}

export function findLolesportsMatch(
  local: LocalMatchCandidate,
  events: LolesportsEvent[],
): AlignedLolesportsMatch | null {
  const externalId = local.lolesportsMatchId;
  const idMatched = externalId
    ? events.filter((event) => event.match.id === externalId || event.id === externalId)
    : [];
  const pool = idMatched.length > 0 ? idMatched : events;

  const candidates = pool
    .map((event) => ({ event, scores: alignEvent(local, event) }))
    .filter(
      (candidate): candidate is {
        event: LolesportsEvent;
        scores: { teamAScore: number; teamBScore: number };
      } => candidate.scores !== null,
    )
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.event.startTime) - Date.parse(local.matchDate)) -
        Math.abs(Date.parse(b.event.startTime) - Date.parse(local.matchDate)),
    );

  const selected = candidates[0];
  if (!selected) return null;

  const timeDifference = Math.abs(
    Date.parse(selected.event.startTime) - Date.parse(local.matchDate),
  );
  if (!externalId && timeDifference > 12 * 60 * 60 * 1000) return null;

  return {
    event: selected.event,
    lolesportsMatchId: selected.event.match.id,
    state: selected.event.match.state ?? selected.event.state,
    teamAScore: selected.scores.teamAScore,
    teamBScore: selected.scores.teamBScore,
    completedGameCount: selected.event.match.games.filter(
      (game) => game.state === "completed",
    ).length,
  };
}

export function hasConsistentCompletedScore(match: AlignedLolesportsMatch) {
  return match.teamAScore + match.teamBScore === match.completedGameCount;
}
