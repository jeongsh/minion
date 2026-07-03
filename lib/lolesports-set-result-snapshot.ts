import type { AlignedLolesportsMatch } from "./lolesports-match-matcher.ts";

export type SetResultSnapshotInput = {
  setId: string;
  matchId: string;
  setNumber: number;
  winnerTeamId: string | null;
};

export function buildLolesportsSetResultSnapshot(
  input: SetResultSnapshotInput,
  external: AlignedLolesportsMatch,
  observedAt: Date,
) {
  const game = external.event.match?.games?.find((item) => item?.number === input.setNumber);
  const externalWinnerTeamId = input.winnerTeamId === external.localTeamAId
    ? external.externalTeamAId
    : input.winnerTeamId === external.localTeamBId
      ? external.externalTeamBId
      : null;

  return {
    set_id: input.setId,
    match_id: input.matchId,
    source: "lolesports",
    external_event_id: external.event.id ?? null,
    external_match_id: external.lolesportsMatchId ?? null,
    external_game_id: game?.id ?? null,
    external_game_state: game?.state ?? null,
    external_team_a_id: external.externalTeamAId,
    external_team_b_id: external.externalTeamBId,
    external_winner_team_id: externalWinnerTeamId,
    winner_team_id: input.winnerTeamId,
    set_number: input.setNumber,
    team_a_score: external.teamAScore,
    team_b_score: external.teamBScore,
    observed_at: observedAt.toISOString(),
    raw_payload: {
      eventId: external.event.id ?? null,
      eventState: external.event.state ?? null,
      matchId: external.event.match?.id ?? null,
      matchState: external.event.match?.state ?? null,
      game: game ?? null,
    },
    updated_at: observedAt.toISOString(),
  };
}
