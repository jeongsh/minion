import type { Match, Player, PlayerPosition, PlayerStatLine, SetResult, Team } from "@/lib/types";

export type PlayerRecord = { player: Player; team?: Team; games: number; wins: number; kills: number; deaths: number; assists: number; kda: number; killParticipation: number; dpm: number; csPerMinute: number; damageShare: number; goldDiffAt15: number | null };
export type TeamRecord = { team: Team; matches: number; matchWins: number; games: number; wins: number; kills: number; deaths: number; kda: number; averageDuration: number; dpm: number };

const isCompletedSet = (set: SetResult) => set.status === "finished" || set.status === "data_synced" || Boolean(set.winnerTeamId);

export function buildPlayerRecords({ players, teams, sets, statLines, position }: { players: Player[]; teams: Team[]; sets: SetResult[]; statLines: PlayerStatLine[]; position?: PlayerPosition }): PlayerRecord[] {
  const completedSets = new Map(sets.filter(isCompletedSet).map((set) => [set.id, set]));
  const playersById = new Map(players.map((player) => [player.id, player]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const teamKills = new Map<string, number>();
  const teamDamage = new Map<string, number>();
  for (const line of statLines) {
    if (!completedSets.has(line.setId)) continue;
    const key = `${line.setId}:${line.teamId}`;
    teamKills.set(key, (teamKills.get(key) ?? 0) + line.kills);
    teamDamage.set(key, (teamDamage.get(key) ?? 0) + line.damageToChampions);
  }

  type Aggregate = { games: number; wins: number; kills: number; deaths: number; assists: number; minutes: number; damage: number; cs: number; teamKills: number; teamDamage: number; goldDiffAt15Total: number; goldDiffAt15Count: number };
  const byPlayer = new Map<string, Aggregate>();
  for (const line of statLines) {
    const set = completedSets.get(line.setId);
    const player = playersById.get(line.playerId);
    if (!set || !player || (position && player.position !== position)) continue;
    const row = byPlayer.get(player.id) ?? { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, minutes: 0, damage: 0, cs: 0, teamKills: 0, teamDamage: 0, goldDiffAt15Total: 0, goldDiffAt15Count: 0 };
    const key = `${line.setId}:${line.teamId}`;
    row.games += 1;
    row.wins += set.winnerTeamId === line.teamId ? 1 : 0;
    row.kills += line.kills;
    row.deaths += line.deaths;
    row.assists += line.assists;
    row.minutes += line.gameMinutes;
    row.damage += line.damageToChampions;
    row.cs += line.cs;
    row.teamKills += teamKills.get(key) ?? 0;
    row.teamDamage += teamDamage.get(key) ?? 0;
    if (line.goldDiffAt15 != null) { row.goldDiffAt15Total += line.goldDiffAt15; row.goldDiffAt15Count += 1; }
    byPlayer.set(player.id, row);
  }

  return [...byPlayer.entries()].map(([playerId, row]) => {
    const player = playersById.get(playerId)!;
    return {
      player,
      team: teamsById.get(player.teamId),
      games: row.games,
      wins: row.wins,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      kda: (row.kills + row.assists) / Math.max(row.deaths, 1),
      killParticipation: ((row.kills + row.assists) / Math.max(row.teamKills, 1)) * 100,
      dpm: row.damage / Math.max(row.minutes, 1),
      csPerMinute: row.cs / Math.max(row.minutes, 1),
      damageShare: (row.damage / Math.max(row.teamDamage, 1)) * 100,
      goldDiffAt15: row.goldDiffAt15Count ? row.goldDiffAt15Total / row.goldDiffAt15Count : null,
    };
  }).sort((a, b) => b.kda - a.kda || b.games - a.games);
}

export function buildTeamRecords({ teams, matches, sets, statLines }: { teams: Team[]; matches: Match[]; sets: SetResult[]; statLines: PlayerStatLine[] }): TeamRecord[] {
  const completedSets = sets.filter(isCompletedSet);
  const setIds = new Set(completedSets.map((set) => set.id));
  const matchTotals = new Map<string, { total: number; wins: number }>();
  const aggregates = new Map<string, { games: number; wins: number; kills: number; deaths: number; damage: number; minutes: number }>();
  for (const match of matches.filter((item) => item.status === "completed")) {
    for (const teamId of [match.teamAId, match.teamBId]) {
      const row = matchTotals.get(teamId) ?? { total: 0, wins: 0 };
      row.total += 1; row.wins += match.winnerTeamId === teamId ? 1 : 0; matchTotals.set(teamId, row);
    }
  }
  for (const set of completedSets) {
    for (const teamId of [set.blueTeamId, set.redTeamId]) {
      const row = aggregates.get(teamId) ?? { games: 0, wins: 0, kills: 0, deaths: 0, damage: 0, minutes: 0 };
      row.games += 1; row.wins += set.winnerTeamId === teamId ? 1 : 0; row.minutes += (set.durationSeconds ?? 0) / 60; aggregates.set(teamId, row);
    }
  }
  for (const line of statLines) {
    if (!setIds.has(line.setId)) continue;
    const row = aggregates.get(line.teamId);
    if (row) { row.kills += line.kills; row.deaths += line.deaths; row.damage += line.damageToChampions; }
  }
  return teams.map((team) => {
    const row = aggregates.get(team.id);
    if (!row?.games) return null;
    const match = matchTotals.get(team.id) ?? { total: 0, wins: 0 };
    return { team, matches: match.total, matchWins: match.wins, games: row.games, wins: row.wins, kills: row.kills, deaths: row.deaths, kda: row.kills / Math.max(row.deaths, 1), averageDuration: row.minutes / row.games, dpm: row.damage / Math.max(row.minutes, 1) } satisfies TeamRecord;
  }).filter((row): row is TeamRecord => row !== null).sort((a, b) => b.wins / b.games - a.wins / a.games || b.wins - a.wins);
}
