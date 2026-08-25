import { createHash } from "crypto";

import type { MobileTeamFavoriteDto } from "@/packages/contracts/src/mobile-v1";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getMobileAuth } from "@/lib/mobile/auth";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const [{ teamSlug }, auth, body] = await Promise.all([
    context.params,
    getMobileAuth(request),
    request.json().catch(() => null) as Promise<{ favorite?: unknown } | null>,
  ]);
  if (typeof body?.favorite !== "boolean") return mobileError("BAD_REQUEST", "favorite 값이 필요합니다.", 400);
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);

  const installationId = request.headers.get("x-minion-installation-id")?.trim();
  const voterKey = installationId && installationId.length >= 16 && installationId.length <= 160
    ? createHash("sha256").update(`mobile:${installationId}`).digest("hex")
    : null;
  if (!auth && !voterKey) return mobileError("BAD_REQUEST", "앱 설치 식별자가 필요합니다.", 400);

  const supabase = createSupabaseAdminClient();
  if (body.favorite) {
    const filters = [auth ? `user_id.eq.${auth.user.id}` : null, voterKey ? `voter_key.eq.${voterKey}` : null].filter((value): value is string => Boolean(value));
    const { data: existing } = await supabase.from("team_fans").select("id").eq("team_id", team.id).or(filters.join(",")).limit(1);
    if (!existing?.length) {
      const { error } = await supabase.from("team_fans").insert({ team_id: team.id, user_id: auth?.user.id ?? null, voter_key: voterKey });
      if (error) return mobileError("INTERNAL", "최애팀 팔로우 등록에 실패했습니다.", 500);
    }
  }
  if (auth) {
    const { error } = await supabase.from("profiles").update({ favorite_team_id: body.favorite ? team.id : null }).eq("id", auth.user.id);
    if (error) return mobileError("INTERNAL", "최애팀 설정에 실패했습니다.", 500);
  }
  const data: MobileTeamFavoriteDto = { favorite: body.favorite };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
