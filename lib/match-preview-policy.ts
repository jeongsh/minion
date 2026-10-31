import type { Match, Stage, Tournament } from "./types.ts";

export type MatchPreviewGenerationPhase = "story" | "final";

export const MATCH_PREVIEW_RETRY_BACKOFF_MS = 30 * 60 * 1_000;
export const MATCH_PREVIEW_MAX_FAILURES_PER_PHASE = 2;

export function matchPreviewGenerationPhase(
  matchDate: string,
  nowMs = Date.now(),
): MatchPreviewGenerationPhase | null {
  const startsIn = new Date(matchDate).getTime() - nowMs;
  if (!Number.isFinite(startsIn) || startsIn <= 0) return null;
  return "story";
}

export function matchPreviewFailureRetryAllowed({
  failureCount,
  lastFailureAt,
  nowMs = Date.now(),
}: {
  failureCount: number;
  lastFailureAt: string | null;
  nowMs?: number;
}) {
  if (failureCount <= 0) return true;
  if (failureCount >= MATCH_PREVIEW_MAX_FAILURES_PER_PHASE || !lastFailureAt) return false;
  const failedTime = new Date(lastFailureAt).getTime();
  return Number.isFinite(failedTime) && nowMs - failedTime >= MATCH_PREVIEW_RETRY_BACKOFF_MS;
}

export function isPremiumMatchPreview({
  match,
  tournament,
  stage,
}: {
  match: Match;
  tournament?: Tournament;
  stage?: Stage;
}) {
  const identity = [tournament?.name, tournament?.split, stage?.name]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  const premiumWords = [
    "playoff",
    "play-in",
    "play in",
    "final",
    "플레이오프",
    "플레이인",
    "결승",
    "준결승",
    "선발전",
  ];

  return premiumWords.some((word) => identity.includes(word)) ||
    (match.bestOf ?? 0) >= 5;
}
