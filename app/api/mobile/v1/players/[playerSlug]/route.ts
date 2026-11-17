import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobilePlayerDetail } from "@/lib/mobile/player-detail";

export const revalidate = 300;

export async function GET(request: Request, context: { params: Promise<{ playerSlug: string }> }) {
  const { playerSlug } = await context.params;
  const query = new URL(request.url).searchParams;
  const data = await getMobilePlayerDetail(playerSlug, query.get("segment"), ["web-parity-v3", "web-parity-v4"].includes(query.get("view") ?? ""), query.get("view") === "web-parity-v4");
  if (!data) return mobileError("NOT_FOUND", "선수를 찾을 수 없습니다.", 404);
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
}
