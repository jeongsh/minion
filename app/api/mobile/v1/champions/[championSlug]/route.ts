import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileChampionDetail } from "@/lib/mobile/champion-page";

export const revalidate = 300;

export async function GET(request: Request, context: { params: Promise<{ championSlug: string }> }) {
  const { championSlug } = await context.params;
  const data = await getMobileChampionDetail(championSlug, new URL(request.url).searchParams);
  if (!data) return mobileError("NOT_FOUND", "챔피언을 찾을 수 없습니다.", 404);
  return mobileSuccess(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" },
  });
}
