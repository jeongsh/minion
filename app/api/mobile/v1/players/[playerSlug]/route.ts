import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobilePlayerDetail } from "@/lib/mobile/player-detail";

export const revalidate = 300;

export async function GET(request: Request, context: { params: Promise<{ playerSlug: string }> }) {
  const { playerSlug } = await context.params;
  const segment = new URL(request.url).searchParams.get("segment");
  const data = await getMobilePlayerDetail(playerSlug, segment);
  if (!data) return mobileError("NOT_FOUND", "선수를 찾을 수 없습니다.", 404);
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
}
