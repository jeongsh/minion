import { getPlayerBySlug, getPlayerReviewPage, getPlayerStatSetIds, getSetsByIds, getMatchesForScope, getTournaments, type PlayerReviewCursor } from "@/lib/data/lck";
import { playerReviewItems, type FanReviewPage } from "@/lib/player-reviews";
import { filterMatchesBySegment, filterSetsByMatches, parseSeasonSegment } from "@/lib/tournament-filters";

export async function getPlayerReviewFeed(playerSlug: string, segment: string, cursor: PlayerReviewCursor | null): Promise<FanReviewPage | null> {
  const player = await getPlayerBySlug(playerSlug);
  if (!player) return null;
  const [playedSetIds, tournaments] = await Promise.all([getPlayerStatSetIds(player.id), getTournaments()]);
  const sets = await getSetsByIds(playedSetIds);
  const playedMatches = await getMatchesForScope({ ids: [...new Set(sets.map(set => set.matchId))] });
  const matches = filterMatchesBySegment(playedMatches, tournaments, segment === "all" ? "all" : parseSeasonSegment(segment));
  const completedSetIds = new Set(filterSetsByMatches(sets, matches).filter((set) => set.winnerTeamId).map((set) => set.id));
  const page = await getPlayerReviewPage(player.id, playedSetIds.filter((id) => completedSetIds.has(id)), cursor);
  return { items: playerReviewItems(page.ratings, matches, sets), nextCursor: page.nextCursor };
}
