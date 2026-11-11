import type { Match, SetResult, Tournament } from "./types.ts";
import { matchBriefingSample } from "./match-briefing-stats.ts";

/** 비율을 공개하는 최소 표본. 이보다 적으면 화면은 비율 대신 건수만 보여준다. */
export const RECORD_MIN_SAMPLE = 5;
const FORM_MATCHES = 5;

export type RateRecord = { wins: number; games: number };

/** 팀 기준 시리즈 스코어 한 종류. label은 "2:0"처럼 자기 팀 점수가 앞이다. */
export type SeriesOutcome = { label: string; win: boolean; count: number };

export type PreviewTeamRecord = {
  teamId: string;
  /** 최근 매치 승패. 오래된 경기부터 최신 순이다. */
  form: Array<"W" | "L">;
  /** form과 같은 최근 매치의 세트 득실. */
  recentSets: RateRecord;
  /** 이번 경기와 같은 BO로 치른 시즌 매치 수. outcomes의 분모다. */
  seriesMatches: number;
  outcomes: SeriesOutcome[];
  /** 시즌 다전제의 1세트 승패. */
  firstSet: RateRecord;
  /** 1세트를 이긴 시즌 다전제의 시리즈 승패. */
  afterFirstSetWin: RateRecord;
  /** 아래 두 평균은 브리핑 차트와 같은 최근 세트 표본을 쓴다. */
  averageMinutes: number | null;
  averageTotalKills: number | null;
  sampleSets: number;
};

export type PreviewHeadToHead = { matches: number; winsA: number; winsB: number; setWinsA: number; setWinsB: number };

export type MatchPreviewRecords = {
  season: number;
  bestOf: number | null;
  teamA: PreviewTeamRecord;
  teamB: PreviewTeamRecord;
};

export function recordRate(record: RateRecord, minimum = RECORD_MIN_SAMPLE) {
  return record.games >= minimum ? Math.round(record.wins / record.games * 100) : null;
}

function average(values: Array<number | null>) {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

function seriesOutcomes(bestOf: number | null): SeriesOutcome[] {
  if (!bestOf || bestOf < 3) return [];
  const need = Math.ceil(bestOf / 2);
  const lost = Array.from({ length: need }, (_, index) => index);
  return [
    ...lost.map((opponent) => ({ label: `${need}:${opponent}`, win: true, count: 0 })),
    ...lost.toReversed().map((own) => ({ label: `${own}:${need}`, win: false, count: 0 })),
  ];
}

function teamRecord(
  teamId: string,
  { bestOf, seasonMatches, recentMatches, sampleSets, firstSetByMatch }: {
    bestOf: number | null;
    seasonMatches: Match[];
    recentMatches: Match[];
    sampleSets: SetResult[];
    firstSetByMatch: Map<string, SetResult>;
  },
): PreviewTeamRecord {
  const score = (item: Match) => item.teamAId === teamId
    ? [item.teamAScore, item.teamBScore]
    : [item.teamBScore, item.teamAScore];
  const recent = recentMatches.slice(0, FORM_MATCHES);
  const recentSets = { wins: 0, games: 0 };
  for (const item of recent) {
    const [own, opponent] = score(item);
    if (own == null || opponent == null) continue;
    recentSets.wins += own;
    recentSets.games += own + opponent;
  }

  const outcomes = seriesOutcomes(bestOf);
  let seriesMatches = 0;
  const firstSet = { wins: 0, games: 0 };
  const afterFirstSetWin = { wins: 0, games: 0 };
  for (const item of seasonMatches) {
    const [own, opponent] = score(item);
    if (item.bestOf === bestOf && own != null && opponent != null) {
      // 몰수나 미완 기록처럼 정상 종료 스코어가 아닌 매치는 분포에서 뺀다.
      const outcome = outcomes.find((entry) => entry.label === `${own}:${opponent}`);
      if (outcome) {
        outcome.count += 1;
        seriesMatches += 1;
      }
    }
    if ((item.bestOf ?? 0) < 3) continue;
    const opener = firstSetByMatch.get(item.id);
    if (!opener) continue;
    firstSet.games += 1;
    if (opener.winnerTeamId !== teamId) continue;
    firstSet.wins += 1;
    afterFirstSetWin.games += 1;
    if (item.winnerTeamId === teamId) afterFirstSetWin.wins += 1;
  }

  return {
    teamId,
    form: recent.toReversed().map((item) => item.winnerTeamId === teamId ? "W" : "L"),
    recentSets,
    seriesMatches,
    outcomes,
    firstSet,
    afterFirstSetWin,
    averageMinutes: average(sampleSets.map((set) => set.durationSeconds == null ? null : set.durationSeconds / 60)),
    averageTotalKills: average(sampleSets.map((set) => set.blueKills == null || set.redKills == null ? null : set.blueKills + set.redKills)),
    sampleSets: sampleSets.length,
  };
}

/**
 * 프리뷰 "전적 비교"의 팀별 기록. 최근 흐름은 브리핑 차트와 같은 표본을, 시리즈 분포와
 * 1세트 기록은 표본이 너무 작아지지 않도록 같은 시즌 전체를 쓴다.
 */
export function buildMatchPreviewRecords({ match, matches, sets, tournaments }: {
  match: Match;
  matches: Match[];
  sets: SetResult[];
  tournaments: Tournament[];
}): MatchPreviewRecords {
  const seasonByTournament = new Map(tournaments.map((item) => [item.id, item.season]));
  const seasonOf = (item: Match) => seasonByTournament.get(item.tournamentId) ?? new Date(item.matchDate).getUTCFullYear();
  const season = seasonOf(match);
  const bestOf = match.bestOf ?? null;
  const cutoff = new Date(match.matchDate).getTime();
  const previous = matches
    .filter((item) => item.id !== match.id && item.status === "completed" && item.winnerTeamId && new Date(item.matchDate).getTime() < cutoff)
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const sample = matchBriefingSample(match, matches, sets);
  const firstSetByMatch = new Map(sets.filter((set) => set.setNumber === 1 && set.winnerTeamId).map((set) => [set.matchId, set]));

  const forTeam = (teamId: string) => {
    const own = previous.filter((item) => item.teamAId === teamId || item.teamBId === teamId);
    const sampleIds = new Set((sample.statByTeam.get(teamId) ?? []).map((item) => item.id));
    return teamRecord(teamId, {
      bestOf,
      seasonMatches: own.filter((item) => seasonOf(item) === season),
      recentMatches: own,
      sampleSets: sample.sets.filter((set) => sampleIds.has(set.matchId) && [set.blueTeamId, set.redTeamId].includes(teamId)),
      firstSetByMatch,
    });
  };
  return { season, bestOf, teamA: forTeam(match.teamAId), teamB: forTeam(match.teamBId) };
}

/** 화면에 나열하는 맞대결 목록과 같은 매치로 합계를 낸다. */
export function buildHeadToHead(match: Match, meetings: Match[]): PreviewHeadToHead {
  const record = { matches: 0, winsA: 0, winsB: 0, setWinsA: 0, setWinsB: 0 };
  for (const item of meetings) {
    record.matches += 1;
    if (item.winnerTeamId === match.teamAId) record.winsA += 1;
    if (item.winnerTeamId === match.teamBId) record.winsB += 1;
    const sameOrder = item.teamAId === match.teamAId;
    record.setWinsA += (sameOrder ? item.teamAScore : item.teamBScore) ?? 0;
    record.setWinsB += (sameOrder ? item.teamBScore : item.teamAScore) ?? 0;
  }
  return record;
}
