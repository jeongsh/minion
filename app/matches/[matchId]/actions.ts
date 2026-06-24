"use server";

import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSetRatingOpen, normalizeSetStatus } from "@/lib/set-status";

const VOTER_COOKIE = "lckhub_match_prediction_voter";
const RATING_VOTER_COOKIE = "lckhub_fan_rating_voter";
const MAX_REVIEW_LENGTH = 240;

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function parseRating(value: FormDataEntryValue | null) {
  const parsed = Number(typeof value === "string" ? value : "");

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
    throw new Error("평점은 1.0점부터 5.0점까지 입력해주세요.");
  }

  const rounded = Math.round(parsed * 2) / 2;
  if (Math.abs(rounded - parsed) > 0.001) {
    throw new Error("평점은 0.5점 단위로 입력해주세요.");
  }

  return rounded;
}

async function getOrCreateCookie(name: string) {
  const cookieStore = await cookies();
  let value = cookieStore.get(name)?.value;

  if (!value) {
    value = randomUUID();
    cookieStore.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return value;
}

function hashVoterKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function predictMatchWinnerAction(formData: FormData) {
  const matchId = textOrNull(formData.get("matchId"));
  const teamId = textOrNull(formData.get("teamId"));

  if (!matchId || !teamId) {
    throw new Error("투표할 경기와 팀을 선택해 주세요.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, leaguepedia_match_id, match_date, team_a_id, team_b_id")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    throw new Error(matchError.message);
  }

  if (!match) {
    throw new Error("경기를 찾을 수 없습니다.");
  }

  if (new Date(match.match_date as string).getTime() <= Date.now()) {
    throw new Error("경기 시작 시간이 지나 승부예측이 마감되었습니다.");
  }

  if (teamId !== match.team_a_id && teamId !== match.team_b_id) {
    throw new Error("이 경기의 참가 팀만 선택할 수 있습니다.");
  }

  const voterKey = await getOrCreateCookie(VOTER_COOKIE);

  const { error } = await supabase.from("fan_match_predictions").upsert(
    {
      match_id: match.id,
      team_id: teamId,
      voter_key: voterKey,
    },
    { onConflict: "match_id,voter_key" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/matches/${match.id}`);

  if (match.leaguepedia_match_id) {
    revalidatePath(`/matches/${encodeURIComponent(match.leaguepedia_match_id as string)}`);
  }
}

export async function submitSetPlayerRatingAction(formData: FormData) {
  const routeMatchId = textOrNull(formData.get("matchId"));
  const setId = textOrNull(formData.get("setId"));
  const playerId = textOrNull(formData.get("playerId"));
  const rating = parseRating(formData.get("rating"));
  const review = textOrNull(formData.get("review"));

  if (!routeMatchId || !setId || !playerId) {
    throw new Error("평점을 제출할 세트와 선수를 확인해주세요.");
  }

  if (review && review.length > MAX_REVIEW_LENGTH) {
    throw new Error(`리뷰는 ${MAX_REVIEW_LENGTH}자 이내로 입력해주세요.`);
  }

  const supabase = createSupabaseAdminClient();
  const { data: set, error: setError } = await supabase
    .from("sets")
    .select("id, match_id, status")
    .eq("id", setId)
    .maybeSingle();

  if (setError) {
    throw new Error(setError.message);
  }

  if (!set) {
    throw new Error("세트를 찾을 수 없습니다.");
  }

  if (!isSetRatingOpen({ status: normalizeSetStatus(set.status) })) {
    throw new Error("세트 상태를 경기종료로 변경하면 평점이 열립니다.");
  }

  const { data: line, error: lineError } = await supabase
    .from("set_player_stats")
    .select("player_id, team_id")
    .eq("set_id", set.id)
    .eq("player_id", playerId)
    .maybeSingle();

  if (lineError) {
    throw new Error(lineError.message);
  }

  if (!line) {
    throw new Error("해당 세트의 평점 대상 선수가 아닙니다.");
  }

  const voterKey = hashVoterKey(await getOrCreateCookie(RATING_VOTER_COOKIE));
  const { error } = await supabase.from("fan_ratings").upsert(
    {
      set_id: set.id,
      match_id: set.match_id,
      player_id: line.player_id,
      team_id: line.team_id,
      voter_key: voterKey,
      rating,
      review,
    },
    { onConflict: "set_id,player_id,voter_key" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/matches/${set.match_id}`);
  revalidatePath(`/matches/${set.match_id}/sets/${set.id}`);
  revalidatePath(`/matches/${routeMatchId}`);
  revalidatePath(`/matches/${routeMatchId}/sets/${set.id}`);
}
