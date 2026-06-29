// /me 페이지 등에서 쓰는 랭크 조회 헬퍼.
// 쿠키 인증 클라이언트로 본인 데이터를 읽는다(RLS: profiles/lp_ledger public read, attendance 본인).

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { DEFAULT_TIER, type Tier } from "@/lib/rank/config";
import type { LpReason } from "@/lib/rank/record-lp";

export type LedgerEntry = {
  id: string;
  reason: LpReason | string;
  delta: number;
  created_at: string;
};

export type RankSummary = {
  tier: Tier; // effective tier(챌린저 cap 반영)
  baseTier: Tier;
  lp: number;
  overallRank: number | null;
  recentLedger: LedgerEntry[];
  checkedInToday: boolean;
};

const VALID_TIERS = new Set<Tier>([
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "emerald",
  "diamond",
  "master",
  "grandmaster",
  "challenger",
]);

function asTier(value: string | null | undefined): Tier {
  return value && VALID_TIERS.has(value as Tier) ? (value as Tier) : DEFAULT_TIER;
}

export async function getRankSummary(userId: string): Promise<RankSummary> {
  const supabase = await createSupabaseAuthClient();

  // 챌린저 cap 반영된 effective_tier는 ranked_profiles 뷰에서.
  const [rankedRes, ledgerRes, attendanceRes] = await Promise.all([
    supabase
      .from("ranked_profiles")
      .select("base_tier, effective_tier, lp, overall_rank")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("lp_ledger")
      .select("id, reason, delta, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("attendance_checks")
      .select("id")
      .eq("user_id", userId)
      .eq("check_date", new Date().toISOString().slice(0, 10))
      .maybeSingle(),
  ]);

  const ranked = rankedRes.data;

  return {
    tier: asTier(ranked?.effective_tier),
    baseTier: asTier(ranked?.base_tier),
    lp: ranked?.lp ?? 0,
    overallRank: ranked?.overall_rank ?? null,
    recentLedger: (ledgerRes.data ?? []) as LedgerEntry[],
    checkedInToday: Boolean(attendanceRes.data),
  };
}
