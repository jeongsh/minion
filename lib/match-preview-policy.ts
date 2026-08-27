import type { Match, Stage, Tournament } from "./types.ts";

export type MatchPreviewGenerationPhase = "story" | "final";

export const MATCH_PREVIEW_AUTOMATIC_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const MATCH_PREVIEW_FINAL_WINDOW_MS = 2 * 60 * 60 * 1_000;

export function matchPreviewGenerationPhase(
  matchDate: string,
  nowMs = Date.now(),
  allowFarFuture = false,
): MatchPreviewGenerationPhase | null {
  const startsIn = new Date(matchDate).getTime() - nowMs;
  if (!Number.isFinite(startsIn) || startsIn <= 0) return null;
  if (startsIn <= MATCH_PREVIEW_FINAL_WINDOW_MS) return "final";
  if (allowFarFuture || startsIn <= MATCH_PREVIEW_AUTOMATIC_WINDOW_MS) return "story";
  return null;
}

export function matchPreviewNeedsRefresh({
  cachedHash,
  expectedHash,
  cachedPhase,
  expectedPhase,
}: {
  cachedHash: string | null;
  expectedHash: string;
  cachedPhase: string | null;
  expectedPhase: MatchPreviewGenerationPhase;
}) {
  return cachedHash !== expectedHash || cachedPhase !== expectedPhase;
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
