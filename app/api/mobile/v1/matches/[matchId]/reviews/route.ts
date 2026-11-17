import { getMatchRatingComments } from "@/lib/data/match-rating-comments";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { parsePlayerReviewCursor } from "@/lib/player-reviews";
import type { MobileFanRatingPanel } from "@/packages/contracts/src/mobile-v1";

export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const query = new URL(request.url).searchParams;
  const setId = query.get("set") ?? "";
  const playerId = query.get("player");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![matchId, setId, ...(playerId ? [playerId] : [])].every(value => uuid.test(value))) return mobileError("BAD_REQUEST", "잘못된 조회 요청입니다.", 400);
  let cursor;
  try { cursor = parsePlayerReviewCursor(query.get("cursor")); }
  catch { return mobileError("BAD_REQUEST", "리뷰 조회 위치가 올바르지 않습니다.", 400); }
  try {
    const page = await getMatchRatingComments(matchId, setId, playerId, cursor);
    const comments: MobileFanRatingPanel["comments"] = page.items.map(item => ({
      ...item, rating: item.rating / 2,
      authorImage: item.authorImageUrl ? { url: item.authorImageUrl } : null,
      playerImage: item.playerImageUrl ? { url: item.playerImageUrl } : null,
    }));
    return mobileSuccess({ comments, nextCursor: page.nextCursor }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[match-reviews]", error);
    return mobileError("INTERNAL", "코멘트를 불러오지 못했습니다.", 500);
  }
}
