import { createHash } from "crypto";

import type { MobileTeamFanDto } from "@/packages/contracts/src/mobile-v1";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function installationVoterKey(request: Request) {
  const installationId = request.headers.get("x-minion-installation-id")?.trim();
  if (!installationId || installationId.length < 16 || installationId.length > 160) return null;
  return createHash("sha256").update(`mobile:${installationId}`).digest("hex");
}

async function contextFor(request: Request, teamSlug: string) {
  const [team, auth] = await Promise.all([
    getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug)),
    getMobileAuth(request),
  ]);
  if (!team) return { error: mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404) } as const;
  const voterKey = installationVoterKey(request);
  if (!auth && !voterKey) return { error: mobileError("BAD_REQUEST", "앱 설치 식별자가 필요합니다.", 400) } as const;
  return { auth, team, voterKey } as const;
}

function identityFilters(userId: string | undefined, voterKey: string | null) {
  return [userId ? `user_id.eq.${userId}` : null, voterKey ? `voter_key.eq.${voterKey}` : null].filter((value): value is string => Boolean(value));
}

async function fanState(teamId: string, userId: string | undefined, voterKey: string | null): Promise<MobileTeamFanDto> {
  const supabase = createSupabaseAdminClient();
  const filters = identityFilters(userId, voterKey);
  const [{ count }, { data }] = await Promise.all([
    supabase.from("team_fans").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    supabase.from("team_fans").select("id").eq("team_id", teamId).or(filters.join(",")).limit(1),
  ]);
  return { fanCount: count ?? 0, following: Boolean(data?.length) };
}

export async function GET(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await context.params;
  const resolved = await contextFor(request, teamSlug);
  if ("error" in resolved) return resolved.error;
  const data = await fanState(resolved.team.id, resolved.auth?.user.id, resolved.voterKey);
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await context.params;
  const body = await request.json().catch(() => null) as { following?: unknown } | null;
  if (typeof body?.following !== "boolean") return mobileError("BAD_REQUEST", "following 값이 필요합니다.", 400);
  const resolved = await contextFor(request, teamSlug);
  if ("error" in resolved) return resolved.error;

  const supabase = createSupabaseAdminClient();
  const filters = identityFilters(resolved.auth?.user.id, resolved.voterKey);
  const { data: rows, error: findError } = await supabase
    .from("team_fans")
    .select("id")
    .eq("team_id", resolved.team.id)
    .or(filters.join(","));
  if (findError) return mobileError("INTERNAL", "팬 상태를 확인하지 못했습니다.", 500);

  if (body.following && !rows?.length) {
    const { data: insertedFan, error } = await supabase.from("team_fans").insert({
      team_id: resolved.team.id,
      user_id: resolved.auth?.user.id ?? null,
      voter_key: resolved.voterKey,
    }).select("id").single();
    if (error) return mobileError("INTERNAL", "팬 등록에 실패했습니다.", 500);
    if (resolved.auth) {
      const { error: subscriptionError } = await supabase.from("fan_notification_subscriptions").upsert({
        user_id: resolved.auth.user.id,
        team_id: resolved.team.id,
        match_alerts: false,
        live_match_alerts: false,
        instagram_alerts: false,
        video_alerts: false,
        solo_queue_alerts: false,
        news_alerts: false,
      }, { onConflict: "user_id,team_id" });
      if (subscriptionError) {
        await supabase.from("team_fans").delete().eq("id", insertedFan.id);
        return mobileError("INTERNAL", "팬 알림 등록에 실패했습니다.", 500);
      }
    }
  }
  if (!body.following && rows?.length) {
    if (resolved.auth) {
      const { error: subscriptionError } = await supabase
        .from("fan_notification_subscriptions")
        .delete()
        .eq("team_id", resolved.team.id)
        .eq("user_id", resolved.auth.user.id);
      if (subscriptionError) return mobileError("INTERNAL", "팬 알림 해제에 실패했습니다.", 500);
    }
    const { error } = await supabase.from("team_fans").delete().in("id", rows.map((row) => row.id));
    if (error) return mobileError("INTERNAL", "팬 등록 해제에 실패했습니다.", 500);
    if (resolved.auth) {
      await supabase.from("profiles").update({ favorite_team_id: null }).eq("id", resolved.auth.user.id).eq("favorite_team_id", resolved.team.id);
    }
  }

  return mobileSuccess(await fanState(resolved.team.id, resolved.auth?.user.id, resolved.voterKey), { headers: { "Cache-Control": "private, no-store" } });
}
