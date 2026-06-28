"use server";

import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const FAN_VOTER_COOKIE = "lckhub_fan_voter";

async function getOrCreateVoterKey() {
  const cookieStore = await cookies();
  let raw = cookieStore.get(FAN_VOTER_COOKIE)?.value;

  if (!raw) {
    raw = randomUUID();
    cookieStore.set(FAN_VOTER_COOKIE, raw, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 10,
      path: "/",
    });
  }

  return createHash("sha256").update(raw).digest("hex");
}

export async function toggleFanAction(teamId: string, teamSlug: string): Promise<{ ok: boolean; isFan: boolean; error?: string }> {
  const voterKey = await getOrCreateVoterKey();
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("team_fans")
    .select("id")
    .eq("team_id", teamId)
    .eq("voter_key", voterKey)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("team_fans").delete().eq("id", existing.id);
    if (error) return { ok: false, isFan: true, error: error.message };
    await supabase.rpc("adjust_team_popularity", { p_team_id: teamId, p_delta: -5 });
    revalidatePath(`/fan/${teamSlug}`);
    return { ok: true, isFan: false };
  } else {
    const { error } = await supabase.from("team_fans").insert({ team_id: teamId, voter_key: voterKey });
    if (error) return { ok: false, isFan: false, error: error.message };
    await supabase.rpc("adjust_team_popularity", { p_team_id: teamId, p_delta: 5 });
    revalidatePath(`/fan/${teamSlug}`);
    return { ok: true, isFan: true };
  }
}

export async function checkinAction(teamId: string, teamSlug: string): Promise<{ ok: boolean; error?: string }> {
  const voterKey = await getOrCreateVoterKey();
  const supabase = createSupabaseAdminClient();
  const todayKST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const { error } = await supabase.from("team_checkins").insert({
    team_id: teamId,
    voter_key: voterKey,
    checkin_date: todayKST,
  });

  if (error) {
    // unique 제약 위반 = 오늘 이미 다른 팀에서 체크인함
    const alreadyCheckedIn = error.code === "23505";
    return { ok: false, error: alreadyCheckedIn ? "오늘은 이미 다른 팀에서 출석체크를 했어요." : error.message };
  }

  await supabase.rpc("adjust_team_popularity", { p_team_id: teamId, p_delta: 1 });
  revalidatePath(`/fan/${teamSlug}`);
  return { ok: true };
}
