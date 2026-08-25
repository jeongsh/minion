import type { MobileTeamNotificationDto } from "@/packages/contracts/src/mobile-v1";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export const dynamic = "force-dynamic";

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
    const { error } = await auth.supabase.from("fan_notification_subscriptions").upsert({
      match_alerts: true,
      news_alerts: true,
      team_id: team.id,
      user_id: auth.user.id,
    }, { onConflict: "user_id,team_id" });
    if (error) return mobileError("INTERNAL", "알림 설정에 실패했습니다.", 500);
  } else {
    const { error } = await auth.supabase.from("fan_notification_subscriptions").delete().eq("team_id", team.id).eq("user_id", auth.user.id);
    if (error) return mobileError("INTERNAL", "알림 설정에 실패했습니다.", 500);
  }

  const data: MobileTeamNotificationDto = { enabled: body.enabled };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
