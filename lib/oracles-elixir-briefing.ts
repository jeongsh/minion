import type { CargoBriefingRow, LeaguepediaBriefingRows } from "./match-briefing-data.ts";
import { championCatalogEntryForValue, normalizeChampionKey } from "./champions.ts";

type OracleSource = {
  url: string;
  snapshotDate: string;
  aliases: Array<{ name: string; page: string }>;
};

function numeric(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const normalize = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const ROLES: Record<string, string> = { top: "top", jungle: "jng", jgl: "jng", jng: "jng", mid: "mid", bot: "bot", adc: "bot", support: "sup", sup: "sup" };
const role = (value: string | undefined) => ROLES[value?.toLowerCase() ?? ""];
const playerName = (value: string) => normalize(value.replace(/\s*\([^)]*\)$/, ""));
const championName = (value: string) => normalizeChampionKey(championCatalogEntryForValue(value)?.ddragon_id ?? value);
const isTeamRow = (row: CargoBriefingRow) => row.position === "team" || (!row.position && ["100", "200"].includes(row.participantid ?? ""));

/** 공식 LPL 경기 ID, 세트 번호, 팀, 진영, 결과, 길이를 대조하고 누락된 지표만 보충한다. */
export function supplementOracleBriefingRows(rows: LeaguepediaBriefingRows, oracleRows: CargoBriefingRow[], source: OracleSource): LeaguepediaBriefingRows {
  const result = { matches: rows.matches.map((row) => ({ ...row })), games: rows.games.map((row) => ({ ...row })), players: rows.players.map((row) => ({ ...row })) };
  const aliases = new Map(source.aliases.map((alias) => [normalize(alias.name), normalize(alias.page)]));
  const team = (value: string | undefined) => value ? aliases.get(normalize(value)) ?? normalize(value) : "";
  const byGame = new Map<string, CargoBriefingRow[]>();
  for (const row of oracleRows) {
    if (row.league !== "LPL" || row.datacompleteness !== "complete" || !row.gameid) continue;
    const group = byGame.get(row.gameid) ?? [];
    group.push(row);
    byGame.set(row.gameid, group);
  }
  const fill = (target: CargoBriefingRow, key: string, value: number | null, gameId: string) => {
    if (value == null || numeric(target[key]) != null) return;
    target[key] = String(value);
    target.EarlyStatsSource = "oracles_elixir";
    target.EarlyStatsSourceUrl = source.url;
    target.EarlyStatsSnapshotDate = source.snapshotDate;
    target.EarlyStatsGameId = gameId;
  };
  for (const game of result.games) {
    let matchId: string | null = null;
    try {
      const url = new URL(game.MatchHistory ?? "");
      if (url.hostname !== "lpl.qq.com") continue;
      matchId = url.searchParams.get("bmid");
    } catch { continue; }
    if (!matchId || !/^\d+$/.test(matchId) || !game.N_GameInMatch) continue;
    const gameId = `${matchId}-${matchId}_game_${game.N_GameInMatch}`;
    const candidates = byGame.get(gameId) ?? [];
    const parts = game.Gamelength?.split(":").map(Number);
    const seconds = parts?.every(Number.isFinite) ? parts.reduce((sum, value) => sum * 60 + value, 0) : null;
    const match = rows.matches.find((row) => row.MatchId === game.MatchId);
    const date = match?.MatchDateTime ? Date.parse(`${match.MatchDateTime.replace(" ", "T")}Z`) : NaN;
    const players = result.players.filter((row) => row.GameId === game.GameId);
    const valid = candidates.filter((row) => {
      const own = team(row.teamname);
      const side = players.find((player) => team(player.Team) === own)?.Side?.toLowerCase();
      const expectedSide = side === "1" ? "blue" : side === "2" ? "red" : side;
      const sourceDate = row.date ? Date.parse(`${row.date.replace(" ", "T")}Z`) : NaN;
      const winner = game.Winner === "1" ? team(game.Team1) : game.Winner === "2" ? team(game.Team2) : "";
      return [team(game.Team1), team(game.Team2)].includes(own) && own !== "" && winner !== ""
        && row.side?.toLowerCase() === expectedSide && numeric(row.game) === numeric(game.N_GameInMatch)
        && numeric(row.result) === (own === winner ? 1 : 0)
        && seconds != null && numeric(row.gamelength) != null && Math.abs(Number(row.gamelength) - seconds) <= 2
        && Number.isFinite(sourceDate) && Number.isFinite(date) && Math.abs(sourceDate - date) < 36 * 60 * 60_000;
    });
    const teamRows = valid.filter(isTeamRow);
    if (teamRows.length === 2 && new Set(teamRows.map((row) => team(row.teamname))).size === 2) {
      for (const [field, key] of [["golddiffat15", "GoldDiffAt15"], ["xpdiffat15", "XpDiffAt15"]]) {
        const values = teamRows.map((row) => numeric(row[field]));
        if (values.some((value) => value == null) || Math.abs(values[0]! + values[1]!) > 0.001) continue;
        teamRows.forEach((row, index) => fill(game, `${team(row.teamname) === team(game.Team1) ? "Team1" : "Team2"}${key}`, values[index], gameId));
      }
    }
    for (const player of players) {
      const found = valid.filter((row) => !isTeamRow(row) && team(row.teamname) === team(player.Team)
        && role(row.position) === role(player.Role) && row.playername && player.Link && playerName(row.playername) === playerName(player.Link)
        && row.champion && player.Champion && championName(row.champion) === championName(player.Champion)
        && numeric(row.kills) === numeric(player.Kills) && numeric(row.deaths) === numeric(player.Deaths) && numeric(row.assists) === numeric(player.Assists));
      if (found.length !== 1) continue;
      const row = found[0];
      for (const minute of [10, 15]) {
        for (const [field, key] of [["gold", "Gold"], ["xp", "Xp"]]) {
          const own = numeric(row[`${field}at${minute}`]), opponent = numeric(row[`opp_${field}at${minute}`]);
          const value = numeric(row[`${field}diffat${minute}`]) ?? (own != null && opponent != null ? own - opponent : null);
          fill(player, `${key}DiffAt${minute}`, value, gameId);
        }
      }
    }
  }
  return result;
}
