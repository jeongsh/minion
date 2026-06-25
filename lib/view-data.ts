import { calculatePlayerStats } from "@/lib/stats";
import type {
  CommunityPost,
  FanRating,
  Match,
  Player,
  PlayerStatLine,
  SetResult,
  Team,
} from "@/lib/types";

export const KST_TIMEZONE = "Asia/Seoul";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatTimeKST(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function formatDateHeaderKST(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(value));
}

export function getMonthKST(value: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, month: "numeric" }).format(
      new Date(value),
    ),
  );
}

export function getYearKST(value: string) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(
      new Date(value),
    ),
  );
}

/** datetime-local input value in KST (YYYY-MM-DDTHH:mm) */
export function formatDateTimeLocalKST(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** Parse datetime-local value as KST wall clock */
export function parseDateTimeLocalKST(value: string) {
  const normalized = value.trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00+09:00`;
  }

  return new Date(value).toISOString();
}

export function findTeam(teams: Team[], teamId: string | null | undefined) {
  return teams.find((team) => team.id === teamId);
}

export function findPlayer(players: Player[], playerId: string | null | undefined) {
  return players.find((player) => player.id === playerId);
}

export function teamLabel(teams: Team[], teamId: string | null | undefined) {
  return findTeam(teams, teamId)?.shortName ?? "-";
}

export function playerLabel(players: Player[], playerId: string | null | undefined) {
  return findPlayer(players, playerId)?.name ?? "-";
}

export function matchRouteId(match: Match) {
  return encodeURIComponent(match.leaguepediaMatchId || match.id);
}

export function matchHref(match: Match) {
  return `/matches/${matchRouteId(match)}`;
}

export function setHref(match: Match, set: SetResult) {
  return `${matchHref(match)}/sets/${set.id}`;
}

export function durationLabel(seconds: number | null | undefined) {
  if (!seconds) {
    return "-";
  }

  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export function matchSetScore(match: Match, sets: SetResult[], teams: Team[]) {
  const relatedSets = sets.filter((set) => set.matchId === match.id);

  if (relatedSets.length === 0) {
    return "-";
  }

  return relatedSets
    .map((set) => `${set.setNumber}세트 ${teamLabel(teams, set.winnerTeamId)}`)
    .join(" / ");
}

export function topFanRatingForMatch(
  matchId: string,
  fanRatings: FanRating[],
  players: Player[],
) {
  const leader = fanRatingLeader(
    fanRatings.filter((item) => item.matchId === matchId),
  );

  if (!leader) {
    return "-";
  }

  return `${playerLabel(players, leader.playerId)} ${leader.average.toFixed(1)} (${leader.count})`;
}

export function fanRatingLeader(fanRatings: FanRating[]) {
  const byPlayer = new Map<
    string,
    { playerId: string; total: number; count: number; latestAt: string }
  >();

  for (const rating of fanRatings) {
    const current = byPlayer.get(rating.playerId);

    if (!current) {
      byPlayer.set(rating.playerId, {
        playerId: rating.playerId,
        total: rating.rating,
        count: 1,
        latestAt: rating.createdAt,
      });
      continue;
    }

    current.total += rating.rating;
    current.count += 1;
    if (new Date(rating.createdAt).getTime() > new Date(current.latestAt).getTime()) {
      current.latestAt = rating.createdAt;
    }
  }

  return (
    [...byPlayer.values()]
      .map((item) => ({
        ...item,
        average: item.total / item.count,
      }))
      .sort((a, b) => {
        if (b.average !== a.average) return b.average - a.average;
        if (b.count !== a.count) return b.count - a.count;
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
      })[0] ?? null
  );
}

export function fanPogPlayerIdForSet(setId: string, fanRatings: FanRating[]) {
  return (
    fanRatingLeader(fanRatings.filter((rating) => rating.setId === setId))
      ?.playerId ?? null
  );
}

export function fanPogSummaryForMatch(
  matchId: string,
  sets: SetResult[],
  fanRatings: FanRating[],
  players: Player[],
) {
  const relatedSets = sets.filter((set) => set.matchId === matchId);

  if (relatedSets.length === 0) {
    return "-";
  }

  return relatedSets
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => {
      const leader = fanRatingLeader(
        fanRatings.filter((rating) => rating.setId === set.id),
      );

      if (!leader) {
        return `${set.setNumber}세트 -`;
      }

      return `${set.setNumber}세트 ${playerLabel(players, leader.playerId)} ${leader.average.toFixed(1)}`;
    })
    .join(" / ");
}

export function buildTeamStandingRows(
  teams: Team[],
  matches: Match[],
  sets: SetResult[],
) {
  return teams.map((team) => {
    const teamMatches = matches.filter(
      (match) => match.teamAId === team.id || match.teamBId === team.id,
    );
    const completedMatches = teamMatches.filter((match) => match.status === "completed");
    const matchWins = completedMatches.filter((match) => match.winnerTeamId === team.id).length;
    const matchLosses = completedMatches.length - matchWins;
    // 세트 전적: sets 테이블 우선, 없으면 match 스코어에서 산출
    const teamSets = sets.filter((set) => set.blueTeamId === team.id || set.redTeamId === team.id);
    let setWins: number;
    let setLosses: number;
    if (teamSets.length > 0) {
      setWins = teamSets.filter((set) => set.winnerTeamId === team.id).length;
      setLosses = teamSets.filter((set) => set.winnerTeamId && set.winnerTeamId !== team.id).length;
    } else {
      setWins = completedMatches.reduce((acc, match) => {
        const score = match.teamAId === team.id ? match.teamAScore : match.teamBScore;
        return acc + (score ?? 0);
      }, 0);
      setLosses = completedMatches.reduce((acc, match) => {
        const score = match.teamAId === team.id ? match.teamBScore : match.teamAScore;
        return acc + (score ?? 0);
      }, 0);
    }
    const nextMatch = teamMatches
      .filter((match) => match.status !== "completed")
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())[0];

    return {
      rank: 0,
      team,
      matchWins,
      matchLosses,
      matchRecord: `${matchWins}-${matchLosses}`,
      setRecord: `${setWins}-${setLosses}`,
      winRate:
        completedMatches.length === 0
          ? "-"
          : `${Math.round((matchWins / completedMatches.length) * 100)}%`,
      setDiff: setWins - setLosses,
      recent: completedMatches
        .slice(-5)
        .map((match) => (match.winnerTeamId === team.id ? "W" : "L"))
        .join("-") || "-",
      nextMatch,
    };
  }).sort((a, b) => {
    // 1순위: 승수 내림차순
    if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
    // 2순위: 패수 오름차순
    if (a.matchLosses !== b.matchLosses) return a.matchLosses - b.matchLosses;
    // 3순위: 세트 득실 내림차순
    return b.setDiff - a.setDiff;
  }).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildTeamSummary({
  team,
  teams,
  players,
  matches,
  sets,
  fanRatings,
  communityPosts,
}: {
  team: Team;
  teams: Team[];
  players: Player[];
  matches: Match[];
  sets: SetResult[];
  fanRatings: FanRating[];
  communityPosts: CommunityPost[];
}) {
  const standings = buildTeamStandingRows(teams, matches, sets);
  const teamMatches = matches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const fanRatingItems = fanRatings.filter((rating) => rating.teamId === team.id);
  const avgFanRating =
    fanRatingItems.length === 0
      ? "-"
      : (
          fanRatingItems.reduce((sum, rating) => sum + rating.rating, 0) /
          fanRatingItems.length
        ).toFixed(1);

  return {
    standing: standings.find((row) => row.team.id === team.id),
    matches: teamMatches,
    players: teamPlayers,
    avgFanRating,
    fanPogCount: fanRatingItems.length,
    officialPomCount: matches.filter((match) =>
      teamPlayers.some((player) => player.id === match.officialPomPlayerId),
    ).length,
    recentReviews: communityPosts.filter(
      (post) => post.siteScope === "team" && post.teamId === team.id,
    ),
  };
}

export type LeagueAverageInput = {
  avgKda: number;
  avgDmg: number;
  avgGoldDiff: number;
  avgObjectives: number;
};

export function buildLeagueRadarStats(league: LeagueAverageInput) {
  const cap = (v: number) => Math.min(Math.max(Math.round(v), 0), 100);
  return {
    radarKda:       cap((league.avgKda / 5) * 100),
    radarWinRate:   cap(50 * (10 / 6)),
    radarGoldDiff:  cap(((league.avgGoldDiff + 3000) / 6000) * 100),
    radarDamage:    cap((league.avgDmg / 120000) * 100),
    radarObjective: cap((league.avgObjectives / 6) * 100),
  };
}

type TeamPlayerStatRow = {
  set_id: string;
  kills: number;
  deaths: number;
  assists: number;
  damage_to_champions: number;
  gold_diff_at_15: number | null;
};

export function buildTeamStatSummary(
  teamId: string,
  sets: SetResult[],
  playerStats: TeamPlayerStatRow[] = [],
) {
  const teamSets = sets.filter((set) => set.blueTeamId === teamId || set.redTeamId === teamId);
  const count = Math.max(teamSets.length, 1);
  const teamSetIds = new Set(teamSets.map((s) => s.id));

  const sumBySide = (blueKey: keyof SetResult, redKey: keyof SetResult) =>
    teamSets.reduce((sum, set) => {
      const value = set.blueTeamId === teamId ? set[blueKey] : set[redKey];
      return sum + (typeof value === "number" ? value : 0);
    }, 0);

  const cap = (v: number) => Math.min(Math.max(Math.round(v), 0), 100);

  // sets 기반
  const wins = teamSets.filter((s) => s.winnerTeamId === teamId).length;
  const avgDragons = sumBySide("blueDragons", "redDragons") / count;
  const avgBarons = sumBySide("blueBarons", "redBarons") / count;
  const avgGold = sumBySide("blueGold", "redGold") / count;
  const oppGold = teamSets.reduce((sum, s) => {
    const v = s.blueTeamId === teamId ? s.redGold : s.blueGold;
    return sum + (typeof v === "number" ? v : 0);
  }, 0) / count;

  // set_player_stats 기반
  const relevantStats = playerStats.filter((r) => teamSetIds.has(r.set_id));
  const statsBySet = new Map<string, { kills: number; deaths: number; assists: number; dmg: number; goldDiff: number | null }>();
  for (const r of relevantStats) {
    const cur = statsBySet.get(r.set_id) ?? { kills: 0, deaths: 0, assists: 0, dmg: 0, goldDiff: null };
    cur.kills += r.kills;
    cur.deaths += r.deaths;
    cur.assists += r.assists;
    cur.dmg += r.damage_to_champions;
    if (r.gold_diff_at_15 != null) cur.goldDiff = (cur.goldDiff ?? 0) + r.gold_diff_at_15;
    statsBySet.set(r.set_id, cur);
  }
  const setStatArr = [...statsBySet.values()];
  const psCount = Math.max(setStatArr.length, 1);

  const avgKills = setStatArr.reduce((s, r) => s + r.kills, 0) / psCount;
  const avgDeaths = setStatArr.reduce((s, r) => s + r.deaths, 0) / psCount;
  const avgAssists = setStatArr.reduce((s, r) => s + r.assists, 0) / psCount;
  const avgDmg = setStatArr.reduce((s, r) => s + r.dmg, 0) / psCount;
  const goldDiffSets = setStatArr.filter((r) => r.goldDiff != null);
  const avgGoldDiff = goldDiffSets.length > 0
    ? goldDiffSets.reduce((s, r) => s + (r.goldDiff ?? 0), 0) / goldDiffSets.length
    : (avgGold - oppGold);

  const kda = avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : avgKills + avgAssists;
  const winRate = wins / count;

  return {
    avgKills: avgKills.toFixed(1),
    avgDeaths: avgDeaths.toFixed(1),
    avgAssists: avgAssists.toFixed(1),
    kda: kda.toFixed(2),
    winRate: Math.round(winRate * 100),
    avgGoldDiff: Math.round(avgGoldDiff),
    avgDmg: Math.round(avgDmg),
    setCount: teamSets.length,
    // 레이더 (0~100 정규화)
    radarKda: cap((kda / 5) * 100),                         // 5 KDA = 100
    radarWinRate: cap(winRate * 100 * (10 / 6)),             // 60% = 100
    radarGoldDiff: cap(((avgGoldDiff + 3000) / 6000) * 100), // ±3000 범위
    radarDamage: cap((avgDmg / 120000) * 100),               // 120000 dmg/set = 100
    radarObjective: cap(((avgDragons + avgBarons) / 6) * 100),
  };
}

export function buildPlayerSummary({
  player,
  teams,
  players,
  playerStatLines,
  fanRatings,
  matches,
}: {
  player: Player;
  teams: Team[];
  players: Player[];
  playerStatLines: PlayerStatLine[];
  fanRatings: FanRating[];
  matches: Match[];
}) {
  const statLine = playerStatLines.find((line) => line.playerId === player.id);
  const stats = statLine ? calculatePlayerStats(statLine) : null;
  const team = findTeam(teams, player.teamId);
  const fanRatingItems = fanRatings.filter((rating) => rating.playerId === player.id);
  const avgFanRating =
    fanRatingItems.length === 0
      ? "-"
      : (
          fanRatingItems.reduce((sum, rating) => sum + rating.rating, 0) /
          fanRatingItems.length
        ).toFixed(1);

  return {
    team,
    stats,
    avgFanRating,
    fanPogCount: fanRatingItems.length,
    officialPomCount: matches.filter((match) => match.officialPomPlayerId === player.id).length,
    sameTeamPlayers: players.filter(
      (item) => item.teamId === player.teamId && item.id !== player.id,
    ),
  };
}
