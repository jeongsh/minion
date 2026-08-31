import type { MobileMiniconCatalogDto } from "@/packages/contracts/src/mobile-v1";
import { getUserMiniconPacks } from "@/lib/data/minicons";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileCommunityActor } from "@/lib/mobile/community";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);

  try {
    const data: MobileMiniconCatalogDto = {
      packs: await getUserMiniconPacks(actor.auth?.user.id),
    };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "미니콘을 불러오지 못했습니다.", 500);
  }
}
