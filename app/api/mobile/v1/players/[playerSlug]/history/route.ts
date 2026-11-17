import { getPlayerHistoryPage, mobilePlayerHistory } from "@/lib/data/player-history";
import { parsePlayerReviewCursor } from "@/lib/player-reviews";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ playerSlug: string }> }) {
  const { playerSlug } = await params;
  const query = new URL(request.url).searchParams;
  let cursor;
  try { cursor = parsePlayerReviewCursor(query.get("cursor")); }
  catch { return mobileError("BAD_REQUEST", "기록 조회 위치가 올바르지 않습니다.", 400); }
  try {
    const page = await getPlayerHistoryPage(playerSlug, query.get("segment") ?? "all", cursor);
    if (!page) return mobileError("NOT_FOUND", "선수를 찾을 수 없습니다.", 404);
    return mobileSuccess({ matches: mobilePlayerHistory(page), nextCursor: page.nextCursor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[player-history]", error);
    return mobileError("INTERNAL", "경기 기록을 불러오지 못했습니다.", 500);
  }
}
