import type { MobileMeDto, MobileNotificationPreferences } from "@/packages/contracts/src/mobile-v1";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { resizeImageForWeb } from "@/lib/images/resize-for-web";
import { recordLpEvent } from "@/lib/rank/record-lp";
import { tierProgress, type Tier } from "@/lib/rank/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_AVATAR_BUCKET = "profile-avatars";
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DELETE_ACCOUNT_CONFIRM_TEXT = "탈퇴합니다";
const REAUTH_WINDOW_MS = 5 * 60 * 1000;
const VALID_TIERS = new Set<Tier>(["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master", "grandmaster", "challenger"]);

function asTier(value: string | null | undefined): Tier {
  return value && VALID_TIERS.has(value as Tier) ? value as Tier : "bronze";
}

function translatePasswordError(message: string): string {
  if (message.startsWith("Password should contain at least one character of each") || (/password/i.test(message) && /at least/i.test(message))) return "영문 대/소문자, 숫자, 특수문자를 섞어서 입력해주세요.";
  return message;
}

function profileImageExtension(type: string, name: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  const fromName = name.split(".").pop()?.toLowerCase();
  return fromName && /^[a-z0-9]+$/.test(fromName) ? fromName : "jpg";
}

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
  const [profileResult, rankedResult, attendanceResult, preferencesResult, subscriptionsResult, postsResult, commentsResult, postCountResult, commentCountResult, blocksResult, guestBlocksResult] = await Promise.all([
    supabase.from("profiles").select("nickname, profile_image_url, tier, lp, favorite_team_id").eq("id", user.id).maybeSingle(),
    supabase.from("ranked_profiles").select("effective_tier, lp, overall_rank").eq("id", user.id).maybeSingle(),
    supabase.from("attendance_checks").select("id").eq("user_id", user.id).eq("check_date", new Date().toISOString().slice(0, 10)).maybeSingle(),
    supabase.from("user_notification_preferences").select("in_app_enabled, match_start_enabled, match_events_enabled, rating_open_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("fan_notification_subscriptions").select("team_id").eq("user_id", user.id),
    supabase.from("community_posts").select("id, title, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("community_comments").select("id, post_id, content, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("community_comments").select("id", { count: "exact", head: true }).eq("author_id", user.id),
    supabase.from("community_user_blocks").select("blocked_id").eq("blocker_id", user.id),
    supabase.from("community_guest_blocks").select("guest_key, guest_nickname, created_at").eq("blocker_id", user.id).order("created_at", { ascending: false }),
  ]);
  const blockedIds = (blocksResult.data ?? []).map((item) => item.blocked_id);
  const { data: blockedProfiles } = blockedIds.length
    ? await supabase.from("profiles").select("id, nickname, profile_image_url, tier").in("id", blockedIds)
    : { data: [] };
  const profile = profileResult.data;
  const ranked = rankedResult.data;
  const preferences = preferencesResult.data;
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers as string[] : [];
  const tier = asTier(ranked?.effective_tier ?? profile?.tier);
  const lp = ranked?.lp ?? profile?.lp ?? 0;
  const progress = tierProgress(tier, lp);
  const hasPassword = providers.includes("email");
  const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  return {
    profile: {
      id: user.id,
      email: user.email ?? null,
      nickname: profile?.nickname ?? null,
      profileImage: profile?.profile_image_url ? { url: profile.profile_image_url } : null,
      tier,
      lp,
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
    rank: {
      checkedInToday: Boolean(attendanceResult.data),
      overallRank: ranked?.overall_rank ?? null,
      progressLabel: progress.label,
      progressRatio: progress.progressRatio,
    },
    account: {
      hasPassword,
      recentlyReauthenticated: !hasPassword && Boolean(lastSignInAt) && Date.now() - lastSignInAt < REAUTH_WINDOW_MS,
    },
    activity: {
      postCount: postCountResult.count ?? 0,
      commentCount: commentCountResult.count ?? 0,
      recentPosts: (postsResult.data ?? []).map((item) => ({ id: item.id, title: item.title, createdAt: item.created_at })),
      recentComments: (commentsResult.data ?? []).map((item) => ({ id: item.id, postId: item.post_id, content: plainText(item.content), createdAt: item.created_at })),
    },
    blockedUsers: (blockedProfiles ?? []).map((item) => ({ id: item.id, nickname: item.nickname, profileImage: item.profile_image_url ? { url: item.profile_image_url } : null, tier: item.tier })),
    blockedGuests: (guestBlocksResult.data ?? []).map((item) => ({ guestKey: item.guest_key, nickname: item.guest_nickname ?? "비회원", createdAt: item.created_at })),
  };
}

export async function GET(request: Request) {
  try {
    const data = await readMe(request);
    return data ? mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } }) : mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  } catch (error) {
    const detail = process.env.NODE_ENV === "development" && error instanceof Error ? ` (${error.message})` : "";
    return mobileError("INTERNAL", `내 정보를 불러오지 못했습니다.${detail}`, 500);
  }
}

export async function POST(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const formData = await request.formData().catch(() => null);
  if (!formData) return mobileError("BAD_REQUEST", "요청 본문이 올바르지 않습니다.", 400);
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (nickname.length < 2 || nickname.length > 16) return mobileError("BAD_REQUEST", "닉네임은 2~16자로 입력해주세요.", 400);

  const image = formData.get("profileImage");
  let profileImageUrl: string | undefined;
  if (image instanceof File && image.size > 0) {
    if (!PROFILE_IMAGE_TYPES.has(image.type)) return mobileError("BAD_REQUEST", "프로필 이미지는 PNG, JPG, WEBP만 업로드할 수 있습니다.", 400);
    if (image.size > MAX_PROFILE_IMAGE_BYTES) return mobileError("BAD_REQUEST", "프로필 이미지는 5MB 이하만 업로드할 수 있습니다.", 400);
    let admin;
    try {
      admin = createSupabaseAdminClient();
    } catch {
      return mobileError("INTERNAL", "프로필 이미지 업로드 설정이 필요합니다.", 500);
    }
    try {
      const resized = await resizeImageForWeb(Buffer.from(await image.arrayBuffer()), image.type, { maxEdge: 512 });
      const objectPath = `${auth.user.id}/${crypto.randomUUID()}.${resized.transformed ? resized.extension : profileImageExtension(image.type, image.name)}`;
      const { error: uploadError } = await admin.storage.from(PROFILE_AVATAR_BUCKET).upload(objectPath, resized.bytes, { cacheControl: "31536000", contentType: resized.contentType, upsert: false });
      if (uploadError) return mobileError("INTERNAL", uploadError.message || "프로필 이미지 업로드에 실패했습니다.", 500);
      profileImageUrl = admin.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(objectPath).data.publicUrl;
    } catch {
      return mobileError("BAD_REQUEST", "프로필 이미지를 처리하지 못했습니다.", 400);
    }
  }

  const updates: { nickname: string; profile_image_url?: string } = { nickname };
  if (profileImageUrl) updates.profile_image_url = profileImageUrl;
  const { error } = await auth.supabase.from("profiles").update(updates).eq("id", auth.user.id);
  if (error?.code === "23505") return mobileError("CONFLICT", "이미 사용 중인 닉네임입니다.", 409);
  if (error) return mobileError("INTERNAL", "프로필 변경에 실패했습니다.", 500);
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
    unblockGuestKey?: string;
    checkIn?: boolean;
    passwordChange?: { currentPassword?: string; newPassword?: string; confirmPassword?: string };
    pushToken?: { token: string; platform: "ios" | "android" };
    removePushToken?: string;
  } | null;
  if (!input) return mobileError("BAD_REQUEST", "요청 본문이 올바르지 않습니다.", 400);
  const { supabase, user } = auth;
  if (input.checkIn) {
    const { error } = await supabase.from("attendance_checks").insert({ user_id: user.id });
    if (error?.code === "23505") return mobileError("CONFLICT", "오늘 도장은 이미 콕 찍혀 있어요.", 409);
    if (error) return mobileError("INTERNAL", "출석체크에 실패했습니다.", 500);
    await recordLpEvent({ userId: user.id, reason: "attendance" });
  }
  if (input.passwordChange) {
    const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers as string[] : [];
    if (!providers.includes("email")) return mobileError("BAD_REQUEST", "소셜 로그인 계정은 비밀번호 변경을 지원하지 않습니다.", 400);
    if (!user.email) return mobileError("BAD_REQUEST", "이메일 정보가 없어 비밀번호를 변경할 수 없습니다.", 400);
    const currentPassword = input.passwordChange.currentPassword ?? "";
    const newPassword = input.passwordChange.newPassword ?? "";
    const confirmPassword = input.passwordChange.confirmPassword ?? "";
    if (!currentPassword || !newPassword) return mobileError("BAD_REQUEST", "현재 비밀번호와 새 비밀번호를 입력해주세요.", 400);
    if (newPassword.length < 6) return mobileError("BAD_REQUEST", "새 비밀번호는 6자 이상이어야 합니다.", 400);
    if (newPassword !== confirmPassword) return mobileError("BAD_REQUEST", "새 비밀번호가 서로 일치하지 않습니다.", 400);
    if (newPassword === currentPassword) return mobileError("BAD_REQUEST", "현재 비밀번호와 다른 비밀번호를 입력해주세요.", 400);
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verifyError) return mobileError("BAD_REQUEST", "현재 비밀번호가 올바르지 않습니다.", 400);
    const { error } = await supabase.auth.updateUser({ password: newPassword, current_password: currentPassword });
    if (error) return mobileError("BAD_REQUEST", error.message ? translatePasswordError(error.message) : "비밀번호 변경에 실패했습니다.", 400);
  }
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
  if (input.pushToken) {
    const { token, platform } = input.pushToken;
    if (!token.trim() || (platform !== "ios" && platform !== "android")) {
      return mobileError("BAD_REQUEST", "푸시 토큰 정보가 올바르지 않습니다.", 400);
    }
    // 같은 토큰이 다른 계정에 남아있을 수 있다(기기 재로그인 등) — 새로 등록하는
    // 계정 소유로 갱신되도록 토큰 기준으로 upsert한다.
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        { user_id: user.id, expo_push_token: token, platform, updated_at: new Date().toISOString() },
        { onConflict: "expo_push_token" },
      );
    if (error) return mobileError("INTERNAL", "푸시 토큰을 등록하지 못했습니다.", 500);
  }
  if (input.removePushToken) {
    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("expo_push_token", input.removePushToken);
    if (error) return mobileError("INTERNAL", "푸시 토큰을 해제하지 못했습니다.", 500);
  }
  if (input.unblockUserId) {
    const { error } = await supabase.from("community_user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", input.unblockUserId);
    if (error) return mobileError("INTERNAL", "차단을 해제하지 못했습니다.", 500);
  }
  if (input.unblockGuestKey) {
    const { error } = await supabase.from("community_guest_blocks").delete().eq("blocker_id", user.id).eq("guest_key", input.unblockGuestKey);
    if (error) return mobileError("INTERNAL", "차단을 해제하지 못했습니다.", 500);
  }
  const data = await readMe(request);
  return data ? mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } }) : mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
}

export async function DELETE(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const input = await request.json().catch(() => null) as { confirmText?: string; password?: string } | null;
  if (input?.confirmText?.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT) return mobileError("BAD_REQUEST", `확인 문구를 정확히 입력해주세요. ("${DELETE_ACCOUNT_CONFIRM_TEXT}")`, 400);
  const providers = Array.isArray(auth.user.app_metadata?.providers) ? auth.user.app_metadata.providers as string[] : [];
  const hasPassword = providers.includes("email");
  if (hasPassword) {
    if (!auth.user.email) return mobileError("BAD_REQUEST", "이메일 정보가 없어 탈퇴를 진행할 수 없습니다.", 400);
    if (!input?.password) return mobileError("BAD_REQUEST", "비밀번호를 입력해주세요.", 400);
    const { error } = await auth.supabase.auth.signInWithPassword({ email: auth.user.email, password: input.password });
    if (error) return mobileError("BAD_REQUEST", "비밀번호가 올바르지 않습니다.", 400);
  } else {
    const lastSignInAt = auth.user.last_sign_in_at ? new Date(auth.user.last_sign_in_at).getTime() : 0;
    if (!lastSignInAt || Date.now() - lastSignInAt > REAUTH_WINDOW_MS) return mobileError("BAD_REQUEST", "본인 확인을 위해 소셜 계정으로 다시 로그인한 뒤 탈퇴를 진행해주세요.", 400);
  }
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return mobileError("INTERNAL", "탈퇴 처리 설정이 필요합니다. 관리자에게 문의해주세요.", 500);
  }
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return mobileError("INTERNAL", error.message || "회원 탈퇴에 실패했습니다.", 500);
  return mobileSuccess({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
}
