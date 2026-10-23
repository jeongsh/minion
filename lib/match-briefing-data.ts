import type { Match, Player, PlayerPosition, PlayerStatLine, SetResult, Team } from "./types.ts";
import { normalizeLeaguepediaKey, resolveLeaguepediaIdentity } from "./leaguepedia-identity.ts";
import { buildMatchBriefingStats, matchBriefingSample } from "./match-briefing-stats.ts";

export type BriefingData = { matches: Match[]; sets: SetResult[]; playerStats: PlayerStatLine[] };
export type CargoBriefingRow = Record<string, string | undefined>;
export type LeaguepediaBriefingRows = { matches: CargoBriefingRow[]; games: CargoBriefingRow[]; players: CargoBriefingRow[] };

const ROLES: Record<string, PlayerPosition> = { top: "TOP", jungle: "JGL", mid: "MID", bot: "BOT", adc: "BOT", support: "SUP" };

export function briefingTeamsNeedingData(match: Match, data: BriefingData) {
  const sample = matchBriefingSample(match, data.matches, data.sets);
  const stats = buildMatchBriefingStats(match, data.matches, data.sets, data.playerStats);
  return [stats.teamA, stats.teamB].filter((team) => {
    const recent = sample.byTeam.get(team.teamId) ?? [];
    const expected = recent.reduce((sum, item) => sum + (item.teamAScore ?? 0) + (item.teamBScore ?? 0), 0);
    return recent.length < 5 || recent.some((item) => item.teamAScore == null || item.teamBScore == null)
      || team.statSetCount < expected || team.values.some((value) => value == null);
  }).map((team) => team.teamId);
}

function number(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function duration(value: string | undefined) {
  if (!value) return null;
  const parts = value.split(":").map(Number);
  return parts.every(Number.isFinite) ? parts.reduce((total, part) => total * 60 + part, 0) : null;
}

function gold(value: string | undefined) {
  const parsed = number(value);
  return parsed == null ? null : Math.round(parsed < 1000 ? parsed * 1000 : parsed);
}

/** Merge source IDs first; never create a second copy of a locally stored match or set. */
export function mergeLeaguepediaBriefingData(
  currentMatch: Match, data: BriefingData, rows: LeaguepediaBriefingRows, teams: Team[], players: Player[],
): BriefingData {
  const matches = [...data.matches];
  const sets = [...data.sets];
  const playerStats = [...data.playerStats];
  const identities = teams.map((team) => ({ ...team, short_name: team.shortName, leaguepedia_page: team.leaguepediaPage, source_id: team.sourceTeamId }));
  const playerIdentities = players.map((player) => ({ ...player, leaguepedia_page: player.leaguepediaPage, source_id: player.sourcePlayerId }));
  const aliases = teams.flatMap((team) => (team.searchAliases ?? []).map((page_name) => ({ entity_id: team.id, page_name })));
  const playerAliases = players.flatMap((player) => (player.searchAliases ?? []).map((page_name) => ({ entity_id: player.id, page_name })));
  const teamId = (name: string | undefined) => resolveLeaguepediaIdentity(name, identities, aliases)?.id
    ?? `leaguepedia-team:${normalizeLeaguepediaKey(name)}`;
  const matchMap = new Map<string, Match>();
  for (const row of rows.matches) {
    const date = row.MatchDateTime ? `${row.MatchDateTime.replace(" ", "T")}Z` : "";
    const scoreA = number(row.Team1Score), scoreB = number(row.Team2Score);
    if (!row.MatchId || !row.Team1 || !row.Team2 || !["1", "2"].includes(row.Winner ?? "")
      || scoreA == null || scoreB == null || !Number.isFinite(Date.parse(date))
      || Date.parse(date) >= Math.min(Date.now(), Date.parse(currentMatch.matchDate))) continue;
    const a = teamId(row.Team1), b = teamId(row.Team2);
    // A source match can already exist without its source ID. Match the pair and date before adding it.
    let match = matches.find((item) => item.leaguepediaMatchId === row.MatchId)
      ?? matches.find((item) => Date.parse(item.matchDate) === Date.parse(date)
        && [item.teamAId, item.teamBId].includes(a) && [item.teamAId, item.teamBId].includes(b));
    if (!match) {
      match = { id: `leaguepedia-match:${row.MatchId}`, tournamentId: `leaguepedia-tournament:${row.OverviewPage ?? row.MatchId}`,
        stageId: "", name: `${row.Team1} vs ${row.Team2}`, matchDate: date, status: "completed",
        teamAId: a, teamBId: b, teamAScore: scoreA, teamBScore: scoreB,
        winnerTeamId: row.Winner === "1" ? a : b, officialPomPlayerId: null, groupIndex: 0, leaguepediaMatchId: row.MatchId };
      matches.push(match);
    } else if (match.status !== "completed" || !match.winnerTeamId || match.teamAScore == null || match.teamBScore == null) {
      const reversed = match.teamAId === b;
      const updated = { ...match, status: "completed" as const, teamAScore: reversed ? scoreB : scoreA,
        teamBScore: reversed ? scoreA : scoreB, winnerTeamId: row.Winner === "1" ? a : b };
      matches[matches.indexOf(match)] = updated;
      match = updated;
    }
    matchMap.set(row.MatchId, match);
  }
  for (const row of rows.games) {
    const match = matchMap.get(row.MatchId ?? "");
    const setNumber = number(row.N_GameInMatch);
    if (!match || !row.GameId || !setNumber || !["1", "2"].includes(row.Winner ?? "")) continue;
    const gamePlayers = rows.players.filter((item) => item.GameId === row.GameId);
    const first = teamId(row.Team1), second = teamId(row.Team2);
    const blueSource = gamePlayers.find((item) => item.Side === "1" || item.Side?.toLowerCase() === "blue")?.Team;
    const redSource = gamePlayers.find((item) => item.Side === "2" || item.Side?.toLowerCase() === "red")?.Team;
    const blue = blueSource ? teamId(blueSource) : first;
    const red = redSource ? teamId(redSource) : second;
    const metric = (side: string, name: string) => row[`${side === first ? "Team1" : "Team2"}${name}`];
    if (![match.teamAId, match.teamBId].includes(blue) || ![match.teamAId, match.teamBId].includes(red) || blue === red) continue;
    let set = sets.find((item) => item.leaguepediaGameId === row.GameId)
      ?? sets.find((item) => item.matchId === match.id && item.setNumber === setNumber);
    const incoming: SetResult = { id: set?.id ?? `leaguepedia-game:${row.GameId}`, matchId: match.id, setNumber,
      status: "finished", winnerTeamId: row.Winner === "1" ? first : second, blueTeamId: blue, redTeamId: red,
      durationSeconds: duration(row.Gamelength), blueKills: number(metric(blue, "Kills")), redKills: number(metric(red, "Kills")),
      blueGold: gold(metric(blue, "Gold")), redGold: gold(metric(red, "Gold")), blueDragons: number(metric(blue, "Dragons")), redDragons: number(metric(red, "Dragons")),
      blueBarons: number(metric(blue, "Barons")), redBarons: number(metric(red, "Barons")), blueTowers: number(metric(blue, "Towers")), redTowers: number(metric(red, "Towers")),
      leaguepediaGameId: row.GameId, patch: row.Patch ?? null };
    if (set) {
      const filled = { ...incoming, ...Object.fromEntries(Object.entries(set).filter(([, value]) => value != null)) } as SetResult;
      sets[sets.indexOf(set)] = filled;
      set = filled;
    } else { set = incoming; sets.push(set); }
    for (const line of gamePlayers) {
      const side = teamId(line.Team);
      const position = ROLES[line.Role?.toLowerCase() ?? ""];
      // Required box-score metrics must all exist. Empty source fields are never converted to zero.
      const values = [line.Kills, line.Deaths, line.Assists, line.CS, line.Gold, line.DamageToChampions, line.VisionScore].map(number);
      if (!position || !line.Link || ![blue, red].includes(side) || values.some((value) => value == null) || !set.durationSeconds) continue;
      const playerId = resolveLeaguepediaIdentity(line.Link, playerIdentities, playerAliases)?.id ?? `leaguepedia-player:${normalizeLeaguepediaKey(line.Link)}`;
      const existingIndex = playerStats.findIndex((item) => item.setId === set.id && item.teamId === side && item.position === position);
      const [kills, deaths, assists, cs, playerGold, damage, visionScore] = values as number[];
      const sameSide = gamePlayers.filter((item) => teamId(item.Team) === side);
      const incomingLine: PlayerStatLine = { setId: set.id, playerId, teamId: side, position, kills, deaths, assists, cs, gold: playerGold,
        damageToChampions: damage, visionScore, gameMinutes: set.durationSeconds / 60,
        teamKills: (side === blue ? set.blueKills : set.redKills) ?? sameSide.reduce((sum, item) => sum + (number(item.Kills) ?? 0), 0),
        teamDamage: sameSide.reduce((sum, item) => sum + (number(item.DamageToChampions) ?? 0), 0),
        goldDiffAt10: number(line.GoldDiffAt10), xpDiffAt10: number(line.XpDiffAt10),
        goldDiffAt15: number(line.GoldDiffAt15), xpDiffAt15: number(line.XpDiffAt15),
        itemIds: [], spellIds: [], runeIds: [], roleBoundItem: null, patch: set.patch ?? null };
      if (existingIndex < 0) playerStats.push(incomingLine);
      else {
        const existing = playerStats[existingIndex];
        playerStats[existingIndex] = { ...incomingLine, ...Object.fromEntries(Object.entries(existing).filter(([, value]) => value != null)) } as PlayerStatLine;
      }
    }
  }
  return { matches, sets, playerStats };
}
