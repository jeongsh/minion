import { getPlayerBySlug, getPlayerReviewPage, getPlayerStatSetIds, type PlayerReviewCursor } from "@/lib/data/lck";
import { getPlayerPageSharedData } from "@/lib/data/player-cache";
import { playerReviewItems, type FanReviewPage } from "@/lib/player-reviews";
import { filterMatchesBySegment, filterSetsByMatches, parseSeasonSegment } from "@/lib/tournament-filters";

export async function getPlayerReviewFeed(playerSlug: string, segment: string, cursor: PlayerReviewCursor | null): Promise<FanReviewPage | null> {
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return null;
  const [shared, playedSetIds] = await Promise.all([
    getPlayerPageSharedData(), getPlayerStatSetIds(player.id),
  ]);
  const matches = filterMatchesBySegment(shared.matches, shared.tournaments, segment === "all" ? "all" : parseSeasonSegment(segment));
  const completedSetIds = new Set(filterSetsByMatches(shared.sets, matches).filter((set) => set.winnerTeamId).map((set) => set.id));
  const page = await getPlayerReviewPage(player.id, playedSetIds.filter((id) => completedSetIds.has(id)), cursor);
  return { items: playerReviewItems(page.ratings, matches, shared.sets), nextCursor: page.nextCursor };
}
