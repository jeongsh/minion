import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";

export type FanTemperatureSnapshot = {
  score: number;
  label: string;
  heatCount24h: number;
  onionCountActive: number;
  checkinCountToday: number;
  fanCount: number;
};

export type FanOnionItem = {
  id: string;
  content: string;
  createdAt: string;
  expiresAt: string;
};

type FanOnionRow = {
  id: string;
  content: string;
  created_at: string;
  expires_at: string;
};

function isMissingTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "PGRST205" || error.code === "42P01")
  );
}

function emptySnapshot(): FanTemperatureSnapshot {
  return {
    score: 0,
    label: "차분함",
    heatCount24h: 0,
    onionCountActive: 0,
    checkinCountToday: 0,
    fanCount: 0,
  };
}

function todayKST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function temperatureLabel(score: number) {
  if (score >= 85) return "폭발 직전";
  if (score >= 65) return "뜨거움";
  if (score >= 40) return "예열 중";
  if (score >= 15) return "잔열";
  return "차분함";
}

function mapOnion(row: FanOnionRow): FanOnionItem {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export const getFanTemperatureSnapshot = cache(async function getFanTemperatureSnapshot(
  teamId: string,
): Promise<FanTemperatureSnapshot> {
  if (!canQuerySupabase()) return emptySnapshot();

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const [totals, onions, checkins] = await Promise.all([
    supabase.rpc("read_fan_totals", { p_team_id: teamId, p_since: sinceHours(24) }),
    supabase
      .from("fan_onions")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .gt("expires_at", now),
    supabase
      .from("team_checkins")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("checkin_date", todayKST()),
  ]);
  if (totals.error) throw totals.error;
  const fanCountDistinct = Number(totals.data.fanCount);

  if (onions.error) {
    if (isMissingTableError(onions.error)) {
      return {
        ...emptySnapshot(),
        checkinCountToday: checkins.count ?? 0,
        fanCount: fanCountDistinct,
      };
    }
    throw onions.error;
  }
  if (checkins.error) throw checkins.error;

  const heatWeight = Number(totals.data.heatWeight);
  const heatCount24h = Number(totals.data.heatCount);
  const onionCountActive = onions.count ?? 0;
  const checkinCountToday = checkins.count ?? 0;
  const fanCount = fanCountDistinct;
  const score = Math.min(
    100,
    Math.round(heatWeight * 5 + onionCountActive * 4 + checkinCountToday * 6 + Math.min(fanCount, 300) / 12),
  );

  return {
    score,
    label: temperatureLabel(score),
    heatCount24h,
    onionCountActive,
    checkinCountToday,
    fanCount,
  };
});

export const getActiveFanOnions = cache(async function getActiveFanOnions(
  teamId: string,
  limit = 30,
): Promise<FanOnionItem[]> {
  if (!canQuerySupabase()) return [];

  const { data, error } = await createSupabaseServerClient()
    .from("fan_onions")
    .select("id, content, created_at, expires_at")
    .eq("team_id", teamId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return ((data ?? []) as FanOnionRow[]).map(mapOnion);
});
