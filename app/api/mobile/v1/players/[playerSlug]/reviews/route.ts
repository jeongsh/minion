import { getPlayerReviewFeed } from "@/lib/data/player-review-feed";
import { mobileError, mobileSuccess, toMobilePlayerReview } from "@/lib/mobile/api-response";
import { parsePlayerReviewCursor } from "@/lib/player-reviews";
import type { MobilePlayerReviewPage } from "@/packages/contracts/src/mobile-v1";

export async function GET(request: Request, { params }: { params: Promise<{ playerSlug: string }> }) {
  const query = new URL(request.url).searchParams;
  let cursor;
  try {
    cursor = parsePlayerReviewCursor(query.get("cursor"));
  } catch {
    return mobileError("BAD_REQUEST", "리뷰 조회 위치가 올바르지 않습니다.", 400);
  }
  try {
    const { playerSlug } = await params;
    const page = await getPlayerReviewFeed(playerSlug, query.get("segment") ?? "all", cursor);
    if (!page) return mobileError("NOT_FOUND", "선수를 찾을 수 없습니다.", 404);
    const data: MobilePlayerReviewPage = {
      items: page.items.map(toMobilePlayerReview),
      nextCursor: page.nextCursor ? JSON.stringify(page.nextCursor) : null,
      hasMore: Boolean(page.nextCursor),
    };
    return mobileSuccess(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[mobile-player-reviews]", error);
    return mobileError("INTERNAL", "리뷰를 불러오지 못했습니다.", 500);
  }
}
