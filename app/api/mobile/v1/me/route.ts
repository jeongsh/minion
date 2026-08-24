import type { MobileMeDto, MobileNotificationPreferences } from "@/packages/contracts/src/mobile-v1";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export const dynamic = "force-dynamic";

const defaultPreferences: MobileNotificationPreferences = {
  inAppEnabled: true,
  matchStartEnabled: true,
  matchEventsEnabled: false,
  ratingOpenEnabled: true,
};

function plainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const nodes = (value as { content?: unknown[] }).content ?? [];
  return nodes.flatMap((node): string[] => {
    if (!node || typeof node !== "object") return [];
    const typed = node as { text?: string; content?: unknown[] };
    return [typed.text ?? plainText({ content: typed.content })];
  }).join(" ").trim();
}

async function readMe(request: Request): Promise<MobileMeDto | null> {
  const auth = await getMobileAuth(request);
  if (!auth) return null;
  const { supabase, user } = auth;
  const [profileResult, preferencesResult, subscriptionsResult, postsResult, commentsResult, postCountResult, commentCountResult, blocksResult] = await Promise.all([
    supabase.from("profiles").select("nickname, profile_image_url, tier, lp, favorite_team_id").eq("id", user.id).maybeSingle(),
    supabase.from("user_notification_preferences").select("in_app_enabled, match_start_enabled, match_events_enabled, rating_open_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("fan_notification_subscriptions").select("team_id").eq("user_id", user.id),
    supabase.from("community_posts").select("id, title, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("community_comments").select("id, post_id, content, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("community_comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("community_user_blocks").select("blocked_id").eq("blocker_id", user.id),
  ]);
  const blockedIds = (blocksResult.data ?? []).map((item) => item.blocked_id);
  const { data: blockedProfiles } = blockedIds.length
    ? await supabase.from("profiles").select("id, nickname, profile_image_url, tier").in("id", blockedIds)
    : { data: [] };
  const profile = profileResult.data;
  const preferences = preferencesResult.data;
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers as string[] : [];
  return {
    profile: {
      id: user.id,
      email: user.email ?? null,
      nickname: profile?.nickname ?? null,
      profileImage: profile?.profile_image_url ? { url: profile.profile_image_url } : null,
      tier: profile?.tier ?? "bronze",
      lp: profile?.lp ?? 0,
      favoriteTeamId: profile?.favorite_team_id ?? null,
      followedTeamIds: (subscriptionsResult.data ?? []).map((item) => item.team_id),
      authProvider: (user.app_metadata?.provider as string | undefined) ?? providers[0] ?? null,
      status: "active",
    },
    notificationPreferences: preferences ? {
      inAppEnabled: preferences.in_app_enabled,
      matchStartEnabled: preferences.match_start_enabled,
      matchEventsEnabled: preferences.match_events_enabled,
      ratingOpenEnabled: preferences.rating_open_enabled,
    } : defaultPreferences,
    activity: {
      postCount: postCountResult.count ?? 0,
      commentCount: commentCountResult.count ?? 0,
      recentPosts: (postsResult.data ?? []).map((item) => ({ id: item.id, title: item.title, createdAt: item.created_at })),
      recentComments: (commentsResult.data ?? []).map((item) => ({ id: item.id, postId: item.post_id, content: plainText(item.content), createdAt: item.created_at })),
    },
    blockedUsers: (blockedProfiles ?? []).map((item) => ({ id: item.id, nickname: item.nickname, profileImage: item.profile_image_url ? { url: item.profile_image_url } : null, tier: item.tier })),
  };
}

export async function GET(request: Request) {
  const data = await readMe(request);
  return data ? mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } }) : mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
}

export async function PATCH(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const input = await request.json().catch(() => null) as {
    nickname?: string;
    favoriteTeamId?: string | null;
    followedTeamIds?: string[];
    notificationPreferences?: Partial<MobileNotificationPreferences>;
    unblockUserId?: string;
  } | null;
  if (!input) return mobileError("BAD_REQUEST", "요청 본문이 올바르지 않습니다.", 400);
  const { supabase, user } = auth;
  const profileUpdates: Record<string, unknown> = {};
  if (input.nickname !== undefined) {
    const nickname = input.nickname.trim();
    if (nickname.length < 2 || nickname.length > 16) return mobileError("BAD_REQUEST", "닉네임은 2~16자로 입력해주세요.", 400);
    profileUpdates.nickname = nickname;
  }
  if (input.favoriteTeamId !== undefined) {
    if (input.favoriteTeamId) {
      const { data: team } = await supabase.from("teams").select("id").eq("id", input.favoriteTeamId).maybeSingle();
      if (!team) return mobileError("BAD_REQUEST", "팀 정보를 찾을 수 없습니다.", 400);
    }
    profileUpdates.favorite_team_id = input.favoriteTeamId;
  }
  if (Object.keys(profileUpdates).length) {
    const { error } = await supabase.from("profiles").update(profileUpdates).eq("id", user.id);
    if (error?.code === "23505") return mobileError("CONFLICT", "이미 사용 중인 닉네임입니다.", 409);
    if (error) return mobileError("INTERNAL", "프로필을 저장하지 못했습니다.", 500);
  }
  if (input.notificationPreferences) {
    const next = { ...defaultPreferences, ...input.notificationPreferences };
    const { error } = await supabase.from("user_notification_preferences").upsert({
      user_id: user.id,
      in_app_enabled: Boolean(next.inAppEnabled),
      match_start_enabled: Boolean(next.matchStartEnabled),
      match_events_enabled: Boolean(next.matchEventsEnabled),
      rating_open_enabled: Boolean(next.ratingOpenEnabled),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) return mobileError("INTERNAL", "알림 설정을 저장하지 못했습니다.", 500);
  }
  if (input.followedTeamIds) {
    const teamIds = [...new Set(input.followedTeamIds)].slice(0, 20);
    if (teamIds.length) {
      const { data: validTeams, error: teamError } = await supabase.from("teams").select("id").in("id", teamIds);
      if (teamError || (validTeams ?? []).length !== teamIds.length) return mobileError("BAD_REQUEST", "팔로우 팀 정보가 올바르지 않습니다.", 400);
    }
    const { data: existing, error: readError } = await supabase.from("fan_notification_subscriptions").select("team_id").eq("user_id", user.id);
    if (readError) return mobileError("INTERNAL", "팔로우 팀을 저장하지 못했습니다.", 500);
    const removedIds = (existing ?? []).map((item) => item.team_id).filter((teamId) => !teamIds.includes(teamId));
    if (removedIds.length) {
      const { error } = await supabase.from("fan_notification_subscriptions").delete().eq("user_id", user.id).in("team_id", removedIds);
      if (error) return mobileError("INTERNAL", "팔로우 팀을 저장하지 못했습니다.", 500);
    }
    if (teamIds.length) {
      const { error } = await supabase.from("fan_notification_subscriptions").upsert(teamIds.map((teamId) => ({ user_id: user.id, team_id: teamId })), { onConflict: "user_id,team_id" });
      if (error) return mobileError("INTERNAL", "팔로우 팀을 저장하지 못했습니다.", 500);
    }
  }
  if (input.unblockUserId) {
    const { error } = await supabase.from("community_user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", input.unblockUserId);
    if (error) return mobileError("INTERNAL", "차단을 해제하지 못했습니다.", 500);
  }
  const data = await readMe(request);
  return data ? mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } }) : mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
}
