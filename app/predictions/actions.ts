"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function predictionError(message: string) {
  if (message.includes("LOGIN_REQUIRED")) return "로그인이 필요합니다.";
  if (message.includes("MIN_STAKE_100")) return "최소 참여 금액은 100 SP입니다.";
  if (message.includes("INSUFFICIENT_SP")) return "보유 SP가 부족합니다.";
  if (message.includes("BET_ALREADY_EXISTS")) return "기존 예측을 취소한 뒤 다시 참여해 주세요.";
  if (message.includes("PREDICTION_CLOSED")) return "이미 마감된 경기입니다.";
  if (message.includes("BET_NOT_FOUND")) return "취소할 예측을 찾을 수 없습니다.";
  return "예측을 처리하지 못했습니다.";
}

export async function placePredictionBetAction(formData: FormData) {
  const matchId = text(formData, "matchId");
  const teamId = text(formData, "teamId");
  const stake = Number(text(formData, "stake"));
  if (!matchId || !teamId || !Number.isSafeInteger(stake)) throw new Error("입력값을 확인해 주세요.");

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.rpc("place_prediction_bet", {
    p_match_id: matchId,
    p_team_id: teamId,
    p_stake: stake,
  });
  if (error) throw new Error(predictionError(error.message));

  revalidatePath("/predictions");
  return { balance: Number(data?.[0]?.balance ?? 0) };
}

export async function cancelPredictionBetAction(formData: FormData) {
  const matchId = text(formData, "matchId");
  if (!matchId) throw new Error("취소할 경기를 확인해 주세요.");

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase.rpc("cancel_prediction_bet", { p_match_id: matchId });
  if (error) throw new Error(predictionError(error.message));

  revalidatePath("/predictions");
  return { balance: Number(data ?? 0) };
}
