import type { Match, Player, PlayerPosition, PlayerStatLine, SetResult, Team } from "./types.ts";
import { normalizeLeaguepediaKey, resolveLeaguepediaIdentity } from "./leaguepedia-identity.ts";
import { BRIEFING_MIN_SETS, buildMatchBriefingStats, matchBriefingSample } from "./match-briefing-stats.ts";
import type { MatchPowerRankings } from "./power-rankings.ts";

export type BriefingData = { matches: Match[]; sets: SetResult[]; playerStats: PlayerStatLine[] };
export type CargoBriefingRow = Record<string, string | undefined>;
export type LeaguepediaBriefingRows = { matches: CargoBriefingRow[]; games: CargoBriefingRow[]; players: CargoBriefingRow[] };
export type MatchBriefingSnapshot = {
  version: 1;
  matchId: string;
  matchDate: string;
  teamAId: string;
  teamBId: string;
  rows: LeaguepediaBriefingRows[];
  powerRankings: MatchPowerRankings;
};

export function createMatchBriefingSnapshot(match: Match, rows: LeaguepediaBriefingRows[], powerRankings: MatchPowerRankings): MatchBriefingSnapshot {
  return { version: 1, matchId: match.id, matchDate: match.matchDate, teamAId: match.teamAId, teamBId: match.teamBId, rows, powerRankings };
}

export function restoreMatchBriefingData(match: Match, teams: Team[], players: Player[], data: BriefingData, snapshot?: MatchBriefingSnapshot | null) {
  const powerRankings: MatchPowerRankings = { status: "error", sourceUrl: `https://lolesports.com/en-US/gpr/${new Date(match.matchDate).getUTCFullYear()}/current`, teams: [] };
  if (!snapshot || snapshot.version !== 1 || snapshot.matchId !== match.id || Date.parse(snapshot.matchDate) !== Date.parse(match.matchDate)
    || snapshot.teamAId !== match.teamAId || snapshot.teamBId !== match.teamBId || !Array.isArray(snapshot.rows)) {
    return { ...data, powerRankings };
  }
  // 원본 source ID로 다시 병합하므로 이후 정규 동기화된 경기와 중복되지 않는다.
  const restored = snapshot.rows.reduce((result, rows) => mergeLeaguepediaBriefingData(match, result, rows, teams, players), data);
  return { ...restored, powerRankings: snapshot.powerRankings ?? powerRankings };
}

const ROLES: Record<string, PlayerPosition> = { top: "TOP", jungle: "JGL", mid: "MID", bot: "BOT", adc: "BOT", support: "SUP" };

export function briefingTeamsNeedingData(match: Match, data: BriefingData) {
  const sample = matchBriefingSample(match, data.matches, data.sets);
  const stats = buildMatchBriefingStats(match, data.matches, data.sets, data.playerStats);
  return [stats.teamA, stats.teamB].filter((team) => {
    const recent = sample.statByTeam.get(team.teamId) ?? [];
    const matchIds = new Set(recent.map((item) => item.id));
    const setIds = new Set(sample.sets.filter((set) => matchIds.has(set.matchId)).map((set) => set.id));
    const missingTimeline = data.playerStats.some((line) => line.teamId === team.teamId && setIds.has(line.setId)
      && (["goldDiffAt10", "xpDiffAt10", "goldDiffAt15", "xpDiffAt15"] as const).some((key) => !Number.isFinite(line[key])));
    const missingChampions = data.playerStats.some((line) => line.teamId === team.teamId && setIds.has(line.setId) && !line.championId);
    const missingDragons = sample.sets.some((set) => setIds.has(set.id) && set.id.startsWith("leaguepedia-game:")
      && (set.blueTeamId === team.teamId ? (set.blueDragons ?? 0) > 0 && set.blueFirstDragonAtMs == null
        : set.redTeamId === team.teamId && (set.redDragons ?? 0) > 0 && set.redFirstDragonAtMs == null));
    const expected = recent.reduce((sum, item) => sum + (item.teamAScore ?? 0) + (item.teamBScore ?? 0), 0);
    return expected < BRIEFING_MIN_SETS || recent.some((item) => item.teamAScore == null || item.teamBScore == null)
      || team.statSetCount < expected || team.values.some((value) => value == null) || missingTimeline || missingChampions || missingDragons;
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
  // 같은 원본 이름을 세트/선수 행마다 반복 검색하지 않는다. 매 병합의 ID/별칭 기준은 유지한다.
  const teamIds = new Map<string | undefined, string>();
  const playerIds = new Map<string, string>();
  const teamId = (name: string | undefined) => {
    let id = teamIds.get(name);
    if (id === undefined) {
      id = resolveLeaguepediaIdentity(name, identities, aliases)?.id ?? `leaguepedia-team:${normalizeLeaguepediaKey(name)}`;
      teamIds.set(name, id);
    }
    return id;
  };
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
      blueFirstDragonAtMs: number(row.BlueFirstDragonMs), redFirstDragonAtMs: number(row.RedFirstDragonMs),
      blueGoldDiffAt15: number(metric(blue, "GoldDiffAt15")), redGoldDiffAt15: number(metric(red, "GoldDiffAt15")),
      blueXpDiffAt15: number(metric(blue, "XpDiffAt15")), redXpDiffAt15: number(metric(red, "XpDiffAt15")),
      leaguepediaGameId: row.GameId, patch: row.Patch ?? null };
    if (set) {
      const filled = { ...incoming, ...Object.fromEntries(Object.entries(set).filter(([, value]) => value != null)) } as SetResult;
      sets[sets.indexOf(set)] = filled;
      set = filled;
    } else { set = incoming; sets.push(set); }
    for (const line of gamePlayers) {
      const side = teamId(line.Team);
      const position = ROLES[line.Role?.toLowerCase() ?? ""];
      if (!position || ![blue, red].includes(side)) continue;
      const existingIndex = playerStats.findIndex((item) => item.setId === set.id && item.teamId === side && item.position === position);
      const timelineMetrics = {
        goldDiffAt10: number(line.GoldDiffAt10), xpDiffAt10: number(line.XpDiffAt10),
        goldDiffAt15: number(line.GoldDiffAt15), xpDiffAt15: number(line.XpDiffAt15),
      };
      // 타임라인 지표 보충은 박스 스코어의 시야 점수 등 누락과 독립적으로 처리한다.
      if (existingIndex >= 0) {
        const existing = playerStats[existingIndex];
        playerStats[existingIndex] = {
          ...existing,
          championId: existing.championId ?? line.ChampionId ?? null,
          ...Object.fromEntries(Object.entries(timelineMetrics).map(([key, value]) =>
            [key, existing[key as keyof typeof timelineMetrics] ?? value])),
        };
      }
      // Required box-score metrics must all exist. Empty source fields are never converted to zero.
      const values = [line.Kills, line.Deaths, line.Assists, line.CS, line.Gold, line.DamageToChampions, line.VisionScore].map(number);
      if (!line.Link || values.some((value) => value == null) || !set.durationSeconds) continue;
      let playerId = playerIds.get(line.Link);
      if (playerId === undefined) {
        playerId = resolveLeaguepediaIdentity(line.Link, playerIdentities, playerAliases)?.id ?? `leaguepedia-player:${normalizeLeaguepediaKey(line.Link)}`;
        playerIds.set(line.Link, playerId);
      }
      const [kills, deaths, assists, cs, playerGold, damage, visionScore] = values as number[];
      const sameSide = gamePlayers.filter((item) => teamId(item.Team) === side);
      const incomingLine: PlayerStatLine = { setId: set.id, playerId, teamId: side, position, championId: line.ChampionId ?? null, kills, deaths, assists, cs, gold: playerGold,
        damageToChampions: damage, visionScore, gameMinutes: set.durationSeconds / 60,
        teamKills: (side === blue ? set.blueKills : set.redKills) ?? sameSide.reduce((sum, item) => sum + (number(item.Kills) ?? 0), 0),
        teamDamage: sameSide.reduce((sum, item) => sum + (number(item.DamageToChampions) ?? 0), 0),
        ...timelineMetrics,
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
