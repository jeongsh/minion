"use server";

import { createHash, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getActiveFanOnions, getFanTemperatureSnapshot } from "@/lib/data/fan-pulse";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";

const FAN_VOTER_COOKIE = "lckhub_fan_voter";
const ONION_MAX_LENGTH = 100;
const ONION_COOLDOWN_MS = 60 * 1000;
const FAN_PULSE_NOT_READY = "팬온도/비난양파 DB 마이그레이션이 아직 적용되지 않았어요.";
const ALLOWED_ONION_RETENTION_MINUTES = new Set([5, 15, 30, 60]);
const PROFANITY_PATTERNS = [
  /씨\s*발|시\s*발|ㅅ\s*ㅂ|ㅆ\s*ㅂ/gi,
  /병\s*신|븅\s*신|ㅂ\s*ㅅ/gi,
  /개\s*새\s*끼|개\s*새|개\s*자\s*식/gi,
  /좆|존\s*나|졸\s*라|지\s*랄|꺼\s*져/gi,
  /fuck|shit|bitch|asshole/gi,
];

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

export async function getIsFan(teamId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FAN_VOTER_COOKIE)?.value;
  if (!raw) return false;

  const voterKey = createHash("sha256").update(raw).digest("hex");
  const { data } = await createSupabaseAdminClient()
    .from("team_fans")
    .select("id")
    .eq("team_id", teamId)
    .eq("voter_key", voterKey)
    .maybeSingle();

  return Boolean(data);
}

export async function toggleFanAction(
  teamId: string,
  teamSlug: string,
): Promise<{ ok: boolean; isFan: boolean; error?: string }> {
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
    revalidatePath(`/fan/${teamSlug}`);
    return { ok: true, isFan: false };
  }

  const { error } = await supabase.from("team_fans").insert({ team_id: teamId, voter_key: voterKey });
  if (error) return { ok: false, isFan: false, error: error.message };
  revalidatePath(`/fan/${teamSlug}`);
  return { ok: true, isFan: true };
}

function isMissingNotificationTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "PGRST205" || error.code === "42P01")
  );
}

export async function getFanNotificationEnabled(teamId: string): Promise<boolean> {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("fan_notification_subscriptions")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingNotificationTable(error)) return false;
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function toggleFanNotificationAction(
  teamId: string,
  teamSlug: string,
  nextEnabled: boolean,
): Promise<{ ok: boolean; enabled: boolean; error?: string }> {
  const supabase = await createSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, enabled: false, error: "로그인이 필요합니다." };
  }

  if (!nextEnabled) {
    const { error } = await supabase
      .from("fan_notification_subscriptions")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, enabled: true, error: isMissingNotificationTable(error) ? "알림 DB 마이그레이션이 필요합니다." : error.message };
    }

    revalidatePath(`/fan/${teamSlug}`);
    return { ok: true, enabled: false };
  }

  const { error } = await supabase
    .from("fan_notification_subscriptions")
    .upsert(
      {
        team_id: teamId,
        user_id: user.id,
        match_alerts: true,
        news_alerts: true,
      },
      { onConflict: "user_id,team_id" },
    );

  if (error) {
    return { ok: false, enabled: false, error: isMissingNotificationTable(error) ? "알림 DB 마이그레이션이 필요합니다." : error.message };
  }

  revalidatePath(`/fan/${teamSlug}`);
  return { ok: true, enabled: true };
}

export async function checkinAction(teamId: string, teamSlug: string): Promise<{ ok: boolean; error?: string }> {
  const voterKey = await getOrCreateVoterKey();
  const todayKST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const { error } = await createSupabaseAdminClient().from("team_checkins").insert({
    team_id: teamId,
    voter_key: voterKey,
    checkin_date: todayKST,
  });

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "오늘은 이미 다른 팀에서 출석체크를 했어요." : error.message,
    };
  }

  revalidatePath(`/fan/${teamSlug}`);
  return { ok: true };
}

function normalizeOnionContent(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function maskProfanity(value: string) {
  return PROFANITY_PATTERNS.reduce(
    (next, pattern) => next.replace(pattern, (match) => "＊".repeat(Math.max(2, match.length))),
    value,
  );
}

function isUnsafeOnionContent(value: string) {
  const patterns = [
    /https?:\/\//i,
    /www\./i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/,
    /(죽여|살해|테러|찾아가|주소\s*까|신상\s*까)/,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

function isMissingFanPulseTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "PGRST205" || error.code === "42P01")
  );
}

export async function heatFanTemperatureAction(
  teamId: string,
  teamSlug: string,
): Promise<{
  ok: boolean;
  error?: string;
  snapshot?: Awaited<ReturnType<typeof getFanTemperatureSnapshot>>;
}> {
  const voterKey = await getOrCreateVoterKey();
  const supabase = createSupabaseAdminClient();
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { count, error: countError } = await supabase
    .from("fan_temperature_events")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("voter_key", voterKey)
    .eq("event_type", "heat")
    .gte("created_at", recentCutoff);

  if (countError) {
    return { ok: false, error: isMissingFanPulseTable(countError) ? FAN_PULSE_NOT_READY : countError.message };
  }
  if ((count ?? 0) > 0) {
    return { ok: false, error: "10분에 한 번만 온도를 올릴 수 있어요." };
  }

  const { error } = await supabase.from("fan_temperature_events").insert({
    team_id: teamId,
    voter_key: voterKey,
    event_type: "heat",
    weight: 1,
  });

  if (error) return { ok: false, error: isMissingFanPulseTable(error) ? FAN_PULSE_NOT_READY : error.message };

  revalidatePath(`/fan/${teamSlug}`);
  revalidatePath(`/fan/${teamSlug}/onion`);

  return {
    ok: true,
    snapshot: await getFanTemperatureSnapshot(teamId),
  };
}

export async function createFanOnionAction(input: {
  teamId: string;
  teamSlug: string;
  content: string;
  retentionMinutes: number;
}): Promise<{
  ok: boolean;
  error?: string;
  onions?: Awaited<ReturnType<typeof getActiveFanOnions>>;
  snapshot?: Awaited<ReturnType<typeof getFanTemperatureSnapshot>>;
}> {
  const voterKey = await getOrCreateVoterKey();
  const content = maskProfanity(normalizeOnionContent(input.content));
  const retentionMinutes = ALLOWED_ONION_RETENTION_MINUTES.has(input.retentionMinutes)
    ? input.retentionMinutes
    : 5;

  if (!content) return { ok: false, error: "내용을 입력해주세요." };
  if (content.length > ONION_MAX_LENGTH) {
    return { ok: false, error: `비난양파는 ${ONION_MAX_LENGTH}자까지만 남길 수 있어요.` };
  }
  if (isUnsafeOnionContent(content)) {
    return { ok: false, error: "링크, 연락처, 신상, 위협성 표현은 남길 수 없어요." };
  }

  const supabase = createSupabaseAdminClient();
  const recentCutoff = new Date(Date.now() - ONION_COOLDOWN_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("fan_onions")
    .select("id", { count: "exact", head: true })
    .eq("voter_key", voterKey)
    .gte("created_at", recentCutoff);

  if (countError) {
    return { ok: false, error: isMissingFanPulseTable(countError) ? FAN_PULSE_NOT_READY : countError.message };
  }
  if ((count ?? 0) > 0) {
    return { ok: false, error: "1분에 한 번만 남길 수 있어요. 잠시만 기다려주세요." };
  }

  const { error } = await supabase.from("fan_onions").insert({
    team_id: input.teamId,
    voter_key: voterKey,
    content,
    expires_at: new Date(Date.now() + retentionMinutes * 60 * 1000).toISOString(),
  });

  if (error) return { ok: false, error: isMissingFanPulseTable(error) ? FAN_PULSE_NOT_READY : error.message };

  revalidatePath(`/fan/${input.teamSlug}`);
  revalidatePath(`/fan/${input.teamSlug}/onion`);

  return {
    ok: true,
    onions: await getActiveFanOnions(input.teamId),
    snapshot: await getFanTemperatureSnapshot(input.teamId),
  };
}
