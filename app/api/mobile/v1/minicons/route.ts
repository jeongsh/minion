import type { MobileMiniconCatalogDto } from "@/packages/contracts/src/mobile-v1";
import { getPublishedMiniconPacks } from "@/lib/data/minicons";
import { mobileSuccess } from "@/lib/mobile/api-response";

export async function GET() {
  const data: MobileMiniconCatalogDto = { packs: await getPublishedMiniconPacks() };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=60" } });
}
