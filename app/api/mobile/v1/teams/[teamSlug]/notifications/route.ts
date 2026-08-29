import type { MobileTeamNotificationDto } from "@/packages/contracts/src/mobile-v1";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export const dynamic = "force-dynamic";

function enabled(row: {
  match_alerts: boolean;
  live_match_alerts: boolean;
  instagram_alerts: boolean;
  video_alerts: boolean;
  solo_queue_alerts: boolean;
} | null) {
  return Boolean(row && (row.match_alerts || row.live_match_alerts || row.instagram_alerts || row.video_alerts || row.solo_queue_alerts));
}

export async function GET(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const [auth, { teamSlug }] = await Promise.all([getMobileAuth(request), context.params]);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
  const { data, error } = await auth.supabase
    .from("fan_notification_subscriptions")
    .select("match_alerts, live_match_alerts, instagram_alerts, video_alerts, solo_queue_alerts")
    .eq("team_id", team.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return mobileError("INTERNAL", "알림 설정을 불러오지 못했습니다.", 500);
  return mobileSuccess<MobileTeamNotificationDto>({ enabled: enabled(data) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const [auth, { teamSlug }, body] = await Promise.all([
    getMobileAuth(request),
    context.params,
    request.json().catch(() => null) as Promise<{ enabled?: unknown } | null>,
  ]);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  if (typeof body?.enabled !== "boolean") return mobileError("BAD_REQUEST", "enabled 값이 필요합니다.", 400);
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);

  if (body.enabled) {
    const { data: fan } = await auth.supabase.from("team_fans").select("id").eq("team_id", team.id).eq("user_id", auth.user.id).limit(1).maybeSingle();
    if (!fan) return mobileError("BAD_REQUEST", "팀을 먼저 팔로우해주세요.", 400);
    const { error } = await auth.supabase.from("fan_notification_subscriptions").upsert({
      match_alerts: true,
      live_match_alerts: false,
      instagram_alerts: false,
      video_alerts: false,
      solo_queue_alerts: false,
      news_alerts: false,
      team_id: team.id,
      user_id: auth.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,team_id" });
    if (error) return mobileError("INTERNAL", "알림 설정에 실패했습니다.", 500);
  } else {
    const { error } = await auth.supabase.from("fan_notification_subscriptions").update({
      match_alerts: false,
      live_match_alerts: false,
      instagram_alerts: false,
      video_alerts: false,
      solo_queue_alerts: false,
      news_alerts: false,
      updated_at: new Date().toISOString(),
    }).eq("team_id", team.id).eq("user_id", auth.user.id);
    if (error) return mobileError("INTERNAL", "알림 설정에 실패했습니다.", 500);
  }

  const data: MobileTeamNotificationDto = { enabled: body.enabled };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
