export type LeaguepediaPickBanRow = {
  GameId?: string;
  N_GameInMatch?: string;
  Team1?: string;
  Team2?: string;
  Team1Ban1?: string;
  Team1Ban2?: string;
  Team1Ban3?: string;
  Team1Ban4?: string;
  Team1Ban5?: string;
  Team2Ban1?: string;
  Team2Ban2?: string;
  Team2Ban3?: string;
  Team2Ban4?: string;
  Team2Ban5?: string;
  Team1Pick1?: string;
  Team1Pick2?: string;
  Team1Pick3?: string;
  Team1Pick4?: string;
  Team1Pick5?: string;
  Team2Pick1?: string;
  Team2Pick2?: string;
  Team2Pick3?: string;
  Team2Pick4?: string;
  Team2Pick5?: string;
};

export type LeaguepediaScoreboardDraftRow = {
  GameId?: string;
  N_GameInMatch?: string;
  Team1?: string;
  Team2?: string;
  Team1Bans?: string;
  Team2Bans?: string;
  Team1Picks?: string;
  Team2Picks?: string;
};

const DRAFT_FIELDS = [
  "Team1Ban1", "Team1Ban2", "Team1Ban3", "Team1Ban4", "Team1Ban5",
  "Team2Ban1", "Team2Ban2", "Team2Ban3", "Team2Ban4", "Team2Ban5",
  "Team1Pick1", "Team1Pick2", "Team1Pick3", "Team1Pick4", "Team1Pick5",
  "Team2Pick1", "Team2Pick2", "Team2Pick3", "Team2Pick4", "Team2Pick5",
] as const;

function values(value: string | null | undefined) {
  if (!value?.trim()) return [];
  return value.split(",").map((entry) => entry.trim());
}

function hasDraftValues(row: LeaguepediaPickBanRow) {
  return DRAFT_FIELDS.some((field) => Boolean(row[field]?.trim()));
}

function fromScoreboard(row: LeaguepediaScoreboardDraftRow): LeaguepediaPickBanRow {
  const team1Bans = values(row.Team1Bans);
  const team2Bans = values(row.Team2Bans);
  const team1Picks = values(row.Team1Picks);
  const team2Picks = values(row.Team2Picks);
  const result: LeaguepediaPickBanRow = {
    GameId: row.GameId,
    N_GameInMatch: row.N_GameInMatch,
    Team1: row.Team1,
    Team2: row.Team2,
  };

  for (let index = 0; index < 5; index += 1) {
    result[`Team1Ban${index + 1}` as keyof LeaguepediaPickBanRow] = team1Bans[index];
    result[`Team2Ban${index + 1}` as keyof LeaguepediaPickBanRow] = team2Bans[index];
    result[`Team1Pick${index + 1}` as keyof LeaguepediaPickBanRow] = team1Picks[index];
    result[`Team2Pick${index + 1}` as keyof LeaguepediaPickBanRow] = team2Picks[index];
  }
  return result;
}

export function resolveLeaguepediaPickBanRows(
  scoreboardRows: LeaguepediaScoreboardDraftRow[],
  picksAndBansRows: LeaguepediaPickBanRow[],
) {
  const primaryBySet = new Map(
    picksAndBansRows.map((row) => [String(row.N_GameInMatch ?? ""), row]),
  );
  const primaryByGame = new Map(
    picksAndBansRows.map((row) => [String(row.GameId ?? ""), row]),
  );

  return scoreboardRows.flatMap((scoreboardRow) => {
    const primary = primaryBySet.get(String(scoreboardRow.N_GameInMatch ?? ""))
      ?? primaryByGame.get(String(scoreboardRow.GameId ?? ""));
    if (primary && hasDraftValues(primary)) return [primary];

    const fallback = fromScoreboard(scoreboardRow);
    return hasDraftValues(fallback) ? [fallback] : [];
  });
}
