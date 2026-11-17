import { getFanRatingReactionStates, getMatchReviewPage, getPlayersByIds, type PlayerReviewCursor } from "@/lib/data/lck";

export async function getMatchRatingComments(matchId: string, setId: string, playerId: string | null = null, cursor: PlayerReviewCursor | null = null, viewerId?: string, pageSize = 5) {
  const page = await getMatchReviewPage(matchId, setId, playerId, cursor, pageSize);
  const [players, reactions] = await Promise.all([
    getPlayersByIds(page.ratings.map(rating => rating.playerId)),
    viewerId ? getFanRatingReactionStates(page.ratings.map(rating => rating.id), viewerId) : {} as Record<string, "honor" | "dislike">,
  ]);
  return {
    items: page.ratings.map(rating => {
      const player = players.find(player => player.id === rating.playerId);
      return {
        id: rating.id, matchId: rating.matchId, playerId: rating.playerId,
        playerName: player?.name ?? "-", playerImageUrl: player?.profileImageUrl ?? null,
        rating: rating.rating, review: rating.review, authorId: rating.authorId,
        authorName: rating.authorNickname ?? "익명", authorImageUrl: rating.authorProfileImageUrl,
        authorTier: rating.authorTier, honorCount: rating.honorCount, dislikeCount: rating.dislikeCount,
        initialReaction: reactions[rating.id] ?? null,
      };
    }),
    nextCursor: page.nextCursor,
  };
}
