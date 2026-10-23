import type { Match, Tournament } from "./types.ts";

export { ACCURACY_MIN_GRADED, ACCURACY_MIN_SEGMENT, accuracyRate } from "../packages/contracts/src/preview-accuracy.ts";
const CONFIDENT_PROBABILITY = 70;

export type StoredPreviewPrediction = { matchId: string; winProbabilityA: number | null; generatedAt: string };

export type AccuracyBucket = { hits: number; graded: number };

export type MatchPreviewAccuracy = {
  season: number;
  all: AccuracyBucket;
  domestic: AccuracyBucket;
  international: AccuracyBucket;
  confident: AccuracyBucket;
  /** 최근 채점 경기부터의 적중 여부. */
  recent: boolean[];
};

/** 경기 시작 전에 저장된 승률만 채점한다. 50%는 예측이 없는 것으로 본다. */
export function buildMatchPreviewAccuracy(predictions: StoredPreviewPrediction[], matches: Match[], tournaments: Tournament[], season: number): MatchPreviewAccuracy {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const graded = predictions.flatMap((prediction) => {
    const match = matchById.get(prediction.matchId);
    const probability = prediction.winProbabilityA;
    const tournament = match ? tournamentById.get(match.tournamentId) : undefined;
    if (!match || !tournament || tournament.season !== season || match.status !== "completed" || !match.winnerTeamId
      || probability == null || probability === 50 || Date.parse(prediction.generatedAt) >= Date.parse(match.matchDate)) return [];
    return [{ match, tournament, probability, hit: (probability > 50) === (match.winnerTeamId === match.teamAId) }];
  }).sort((a, b) => Date.parse(b.match.matchDate) - Date.parse(a.match.matchDate));
  const bucket = (items: typeof graded): AccuracyBucket => ({ hits: items.filter((item) => item.hit).length, graded: items.length });
  return {
    season,
    all: bucket(graded),
    domestic: bucket(graded.filter((item) => item.tournament.category !== "international")),
    international: bucket(graded.filter((item) => item.tournament.category === "international")),
    confident: bucket(graded.filter((item) => Math.max(item.probability, 100 - item.probability) >= CONFIDENT_PROBABILITY)),
    recent: graded.slice(0, 10).map((item) => item.hit),
  };
}
