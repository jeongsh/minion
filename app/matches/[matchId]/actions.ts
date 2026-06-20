"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VOTER_COOKIE = "lckhub_match_prediction_voter";

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
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

  const cookieStore = await cookies();
  let voterKey = cookieStore.get(VOTER_COOKIE)?.value;

  if (!voterKey) {
    voterKey = randomUUID();
    cookieStore.set(VOTER_COOKIE, voterKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

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
