import "server-only";

import { cache } from "react";

import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIER, type Tier } from "@/lib/rank/config";
import { getPublicRankProfiles } from "@/lib/rank/public-profile";

export type CommunityUserSummary = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  tier: Tier;
  favoriteTeamId: string | null;
  createdAt: string;
};

export const getCommunityUserSummary = cache(async function getCommunityUserSummary(
  userId: string,
): Promise<CommunityUserSummary | null> {
  if (!canQuerySupabase()) return null;

  const [profileResult, rankProfiles] = await Promise.all([
    createSupabaseServerClient()
      .from("profiles")
      .select("id, nickname, profile_image_url, tier, created_at")
      .eq("id", userId)
      .maybeSingle(),
    getPublicRankProfiles([userId]),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) return null;

  const row = profileResult.data as {
    id: string;
    nickname: string;
    profile_image_url: string | null;
    tier: Tier | null;
    created_at: string;
  };
  const ranked = rankProfiles.get(userId);
  return {
    id: row.id,
    nickname: ranked?.nickname ?? row.nickname,
    profileImageUrl: ranked?.profileImageUrl ?? row.profile_image_url,
    tier: ranked?.tier ?? row.tier ?? DEFAULT_TIER,
    favoriteTeamId: ranked?.favoriteTeamId ?? null,
    createdAt: row.created_at,
  };
});

export const getBlockedCommunityUserIds = cache(async function getBlockedCommunityUserIds(
  blockerId: string,
): Promise<Set<string>> {
  if (!canQuerySupabase()) return new Set();

  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase
    .from("community_user_blocks")
    .select("blocked_id")
    .eq("blocker_id", blockerId);
  if (error) throw error;
  return new Set(((data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id));
});

export async function setCommunityUserBlocked(params: {
  blockerId: string;
  blockedId: string;
  blocked: boolean;
}): Promise<void> {
  const supabase = await createSupabaseAuthClient();
  if (params.blocked) {
    const { error } = await supabase.from("community_user_blocks").insert({
      blocker_id: params.blockerId,
      blocked_id: params.blockedId,
    });
    if (error && error.code !== "23505") throw error;
    return;
  }

  const { error } = await supabase
    .from("community_user_blocks")
    .delete()
    .eq("blocker_id", params.blockerId)
    .eq("blocked_id", params.blockedId);
  if (error) throw error;
}

export async function createCommunityUserReport(params: {
  reporterId: string;
  targetUserId: string;
  reason: string;
  evidencePostId?: string | null;
  evidenceCommentId?: string | null;
}): Promise<void> {
  const supabase = await createSupabaseAuthClient();
  const { error } = await supabase.from("community_user_reports").insert({
    reporter_id: params.reporterId,
    target_user_id: params.targetUserId,
    reason: params.reason,
    evidence_post_id: params.evidencePostId ?? null,
    evidence_comment_id: params.evidenceCommentId ?? null,
  });
  if (error) throw error;
}

export async function isCommunityUserSanctioned(userId: string): Promise<boolean> {
  if (!canQuerySupabase()) return false;
  const { data, error } = await createSupabaseAdminClient()
    .from("community_user_sanctions")
    .select("id")
    .eq("user_id", userId)
    .is("lifted_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listBlockedCommunityUsers(
  blockerId: string,
): Promise<CommunityUserSummary[]> {
  const blockedIds = [...(await getBlockedCommunityUserIds(blockerId))];
  if (blockedIds.length === 0) return [];
  const summaries = await Promise.all(blockedIds.map((id) => getCommunityUserSummary(id)));
  return summaries.filter((profile): profile is CommunityUserSummary => Boolean(profile));
}
