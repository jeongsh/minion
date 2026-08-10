import "server-only";

import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import { canQuerySupabase } from "@/lib/supabase/server";

export type BlockedCommunityGuest = {
  guestKey: string;
  nickname: string;
  createdAt: string;
};

export const getBlockedCommunityGuestKeys = cache(async function getBlockedCommunityGuestKeys(
  blockerId: string,
): Promise<Set<string>> {
  if (!canQuerySupabase()) return new Set();
  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase
    .from("community_guest_blocks")
    .select("guest_key")
    .eq("blocker_id", blockerId);
  if (error) throw error;
  return new Set(((data ?? []) as { guest_key: string }[]).map((row) => row.guest_key));
});

export async function setCommunityGuestBlocked(params: {
  blockerId: string;
  guestKey: string;
  nickname: string;
  blocked: boolean;
}): Promise<void> {
  const supabase = await createSupabaseAuthClient();
  if (params.blocked) {
    const { error } = await supabase.from("community_guest_blocks").insert({
      blocker_id: params.blockerId,
      guest_key: params.guestKey,
      guest_nickname: params.nickname,
    });
    if (error && error.code !== "23505") throw error;
    return;
  }
  const { error } = await supabase
    .from("community_guest_blocks")
    .delete()
    .eq("blocker_id", params.blockerId)
    .eq("guest_key", params.guestKey);
  if (error) throw error;
}

export async function listBlockedCommunityGuests(
  blockerId: string,
): Promise<BlockedCommunityGuest[]> {
  if (!canQuerySupabase()) return [];
  const supabase = await createSupabaseAuthClient();
  const { data, error } = await supabase
    .from("community_guest_blocks")
    .select("guest_key, guest_nickname, created_at")
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { guest_key: string; guest_nickname: string | null; created_at: string }[]).map((row) => ({
    guestKey: row.guest_key,
    nickname: row.guest_nickname ?? "비회원",
    createdAt: row.created_at,
  }));
}

export async function isCommunityGuestSanctioned(guestKey: string, ipKey: string): Promise<boolean> {
  if (!canQuerySupabase()) return false;
  const { data, error } = await createSupabaseAdminClient()
    .from("community_guest_sanctions")
    .select("id")
    .or(`guest_key.eq.${guestKey},ip_key.eq.${ipKey}`)
    .is("lifted_at", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function guestRateLimitError(
  ipKey: string,
  kind: "post" | "comment",
): Promise<string | null> {
  const table = kind === "post"
    ? "community_guest_post_credentials"
    : "community_guest_comment_credentials";
  const recentSeconds = kind === "post" ? 30 : 10;
  const windowMinutes = 10;
  const windowLimit = kind === "post" ? 5 : 20;
  const sinceRecent = new Date(Date.now() - recentSeconds * 1000).toISOString();
  const sinceWindow = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const supabase = createSupabaseAdminClient();
  const [recent, windowed] = await Promise.all([
    supabase.from(table).select("created_at", { count: "exact", head: true }).eq("ip_key", ipKey).gte("created_at", sinceRecent),
    supabase.from(table).select("created_at", { count: "exact", head: true }).eq("ip_key", ipKey).gte("created_at", sinceWindow),
  ]);
  if (recent.error) throw recent.error;
  if (windowed.error) throw windowed.error;
  if ((recent.count ?? 0) > 0) {
    return `${recentSeconds}초 후에 다시 작성해주세요.`;
  }
  if ((windowed.count ?? 0) >= windowLimit) {
    return `비회원은 10분 동안 ${windowLimit}개까지 작성할 수 있습니다.`;
  }
  return null;
}
