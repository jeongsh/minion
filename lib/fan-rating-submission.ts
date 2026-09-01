import { createHash } from "crypto";

import { screenCommunityText } from "@/lib/community/ai-moderation";
import { findProfanity, maskProfanity } from "@/lib/community/content-filter";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { isSetRatingOpen, normalizeSetStatus } from "@/lib/set-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const FAN_RATING_MAX_REVIEW_LENGTH = 240;

type SubmitFanRatingInput = {
  matchId: string;
  playerId: string;
  rating: unknown;
  review: unknown;
  setId: string;
  userId: string;
  voterKey: string;
};

function parseRating(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("평점은 1.0점부터 5.0점까지 입력해주세요.");
  }
  const rounded = Math.round(parsed * 2) / 2;
  if (Math.abs(rounded - parsed) > 0.001) {
    throw new Error("평점은 0.5점 단위로 입력해주세요.");
  }
  return rounded;
}

function normalizedReview(value: unknown) {
  const review = typeof value === "string" ? value.trim() : "";
  if (review.length > FAN_RATING_MAX_REVIEW_LENGTH) {
    throw new Error(`리뷰는 ${FAN_RATING_MAX_REVIEW_LENGTH}자 이내로 입력해주세요.`);
  }
  if (review) {
    const profanity = findProfanity(review);
    if (profanity) {
      throw new Error(`금칙어(${maskProfanity(profanity)})가 포함되어 등록할 수 없습니다. 표현을 수정해 주세요.`);
    }
  }
  return review || null;
}

export async function submitFanRating(input: SubmitFanRatingInput) {
  const matchId = input.matchId.trim();
  const setId = input.setId.trim();
  const playerId = input.playerId.trim();
  if (!matchId || !setId || !playerId) {
    throw new Error("평점을 제출할 세트와 선수를 확인해주세요.");
  }

  const rating = parseRating(input.rating);
  const review = normalizedReview(input.review);
  if (await isCommunityUserSanctioned(input.userId)) {
    throw new Error("커뮤니티 이용이 영구 제한된 계정입니다.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: set, error: setError } = await supabase
    .from("sets")
    .select("id, match_id, status, result_recorded_at")
    .eq("id", setId)
    .maybeSingle();
  if (setError) throw new Error(setError.message);
  if (!set || set.match_id !== matchId) throw new Error("세트를 찾을 수 없습니다.");
  if (!isSetRatingOpen({ status: normalizeSetStatus(set.status), resultRecordedAt: set.result_recorded_at })) {
    throw new Error("세트 결과가 기록된 뒤부터 평점을 입력할 수 있습니다.");
  }

  const { data: line, error: lineError } = await supabase
    .from("set_player_stats")
    .select("player_id, team_id")
    .eq("set_id", set.id)
    .eq("player_id", playerId)
    .maybeSingle();
  if (lineError) throw new Error(lineError.message);
  if (!line) throw new Error("해당 세트의 평점 대상 선수가 아닙니다.");

  const voterKey = createHash("sha256").update(input.voterKey).digest("hex");
  const { data: savedRating, error } = await supabase.from("fan_ratings").upsert(
    {
      set_id: set.id,
      match_id: set.match_id,
      player_id: line.player_id,
      team_id: line.team_id,
      voter_key: voterKey,
      author_id: input.userId,
      rating,
      review,
    },
    { onConflict: "set_id,player_id,author_id" },
  ).select("id").single();
  if (error) throw new Error(error.message);

  return { rating, ratingId: savedRating.id, review };
}

export async function moderateFanRatingReview(ratingId: string, review: string) {
  const verdict = await screenCommunityText({ text: review });
  if (!verdict.flagged) return false;

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("fan_ratings")
    .update({ blinded_at: new Date().toISOString(), blinded_source: "ai" })
    .eq("id", ratingId)
    .is("blinded_at", null);
  const { error } = await supabase.from("fan_rating_reports").insert({
    rating_id: ratingId,
    reporter_id: null,
    source: "ai",
    reason: verdict.detail ? `${verdict.category} - ${verdict.detail}` : verdict.category,
  });
  if (error && error.code !== "23505") throw error;
  return true;
}
