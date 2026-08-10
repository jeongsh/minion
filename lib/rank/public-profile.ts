import "server-only";

import { DEFAULT_TIER, type Tier } from "@/lib/rank/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PublicRankProfile = {
  nickname: string;
  profileImageUrl: string | null;
  tier: Tier;
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

function toTier(value: string | null | undefined): Tier {
  return value && VALID_TIERS.has(value as Tier) ? (value as Tier) : DEFAULT_TIER;
}

export async function getPublicRankProfiles(userIds: string[]): Promise<Map<string, PublicRankProfile>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = createSupabaseServerClient();
  const [profilesResult, ranksResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, profile_image_url, tier")
      .in("id", uniqueIds),
    supabase
      .from("ranked_profiles")
      .select("id, effective_tier")
      .in("id", uniqueIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;

  const effectiveTiers = new Map(
    ((ranksResult.data ?? []) as { id: string; effective_tier: string | null }[])
      .map((row) => [row.id, toTier(row.effective_tier)]),
  );

  return new Map(
    ((profilesResult.data ?? []) as {
      id: string;
      nickname: string;
      profile_image_url: string | null;
      tier: string | null;
    }[]).map((profile) => [
      profile.id,
      {
        nickname: profile.nickname,
        profileImageUrl: profile.profile_image_url,
        tier: effectiveTiers.get(profile.id) ?? toTier(profile.tier),
      },
    ]),
  );
}
