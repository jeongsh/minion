import type { MobileCommunityActionDto, MobileMiniconSettingsDto } from "@/packages/contracts/src/mobile-v1";
import { getPublishedMiniconPacks } from "@/lib/data/minicons";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SELECTED_PACKS = 200;

export async function GET(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const packs = await getPublishedMiniconPacks();
  const admin = createSupabaseAdminClient();
  const { data: selection, error } = await admin
    .from("user_minicon_packs")
    .select("pack_id, sort_order")
    .eq("user_id", auth.user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return mobileError("INTERNAL", "미니콘 설정을 불러오지 못했습니다.", 500);

  const available = new Set(packs.map((pack) => pack.id));
  const persisted = (selection ?? []).map((row: { pack_id: string }) => row.pack_id).filter((id) => available.has(id));
  const fallback = packs.find((pack) => pack.isOfficial) ?? packs[0];
  const data: MobileMiniconSettingsDto = {
    packs,
    selectedPackIds: persisted.length > 0 ? persisted : fallback ? [fallback.id] : [],
    selectionSaved: persisted.length > 0,
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const body = await request.json().catch(() => null) as { packIds?: unknown } | null;
  const raw = body?.packIds;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SELECTED_PACKS || raw.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return mobileError("BAD_REQUEST", "사용할 미니콘 패키지를 한 개 이상 올바르게 선택해 주세요.", 400);
  }
  const packIds = raw as string[];
  if (new Set(packIds).size !== packIds.length) return mobileError("BAD_REQUEST", "중복된 미니콘 패키지가 있습니다.", 400);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("replace_user_minicon_packs", { p_pack_ids: packIds, p_user_id: auth.user.id });
  if (error?.message.includes("MINICON_UNAVAILABLE_SELECTION")) return mobileError("BAD_REQUEST", "현재 공개 중인 미니콘 패키지만 사용할 수 있습니다.", 400);
  if (error) return mobileError("INTERNAL", "미니콘 설정을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.", 500);
  const data: MobileCommunityActionDto = { message: `미니콘 패키지 ${packIds.length}개를 사용할 수 있게 설정했습니다.` };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
