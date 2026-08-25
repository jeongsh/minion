import type { MobileBootstrapDto } from "@/packages/contracts/src/mobile-v1";
import { getTeams } from "@/lib/data/lck";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [teams, auth] = await Promise.all([getTeams(), getMobileAuth(request)]);
  let viewer: MobileBootstrapDto["viewer"] = null;
  if (auth) {
    const [{ data: profile }, { data: subscriptions }] = await Promise.all([
      auth.supabase.from("profiles").select("nickname, profile_image_url, tier, lp, favorite_team_id").eq("id", auth.user.id).maybeSingle(),
      auth.supabase.from("fan_notification_subscriptions").select("team_id").eq("user_id", auth.user.id),
    ]);
    viewer = {
      id: auth.user.id,
      nickname: profile?.nickname ?? null,
      profileImage: profile?.profile_image_url ? { url: profile.profile_image_url } : null,
      tier: profile?.tier ?? "bronze",
      lp: profile?.lp ?? 0,
      favoriteTeamId: profile?.favorite_team_id ?? null,
      favoriteTeamSlug: teams.find((team) => team.id === profile?.favorite_team_id)?.slug ?? null,
      followedTeamIds: (subscriptions ?? []).map((item) => item.team_id),
    };
  }
  const data: MobileBootstrapDto = {
    minimumSupportedVersion: "1.0.0",
    maintenance: { enabled: false, message: null },
    viewer,
    teams: teams.filter((team) => team.isLckTeam).map(toMobileTeam),
    featureFlags: { auth: true, appleLogin: true, naverLogin: true },
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
