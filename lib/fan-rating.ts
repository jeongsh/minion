import type { FanRating } from "@/lib/types";

export const PLAYER_FAN_POG_CACHE_TAG = "player-fan-pog";

export function fanRatingSummaryLeader<T extends { playerId: string; teamId: string; total: number; count: number; latestAt: string }>(rows: T[], winnerTeamId: string | null | undefined) {
  return rows.filter(row => row.teamId === winnerTeamId)
    .sort((a, b) => b.total / b.count - a.total / a.count || b.count - a.count || Date.parse(b.latestAt) - Date.parse(a.latestAt))[0] ?? null;
}

type FanRatingForPog = Pick<
  FanRating,
  "setId" | "playerId" | "teamId" | "rating" | "createdAt"
>;

export function fanRatingLeader(fanRatings: FanRatingForPog[]) {
  const byPlayer = new Map<
    string,
    { playerId: string; total: number; count: number; latestAt: string }
  >();

  for (const rating of fanRatings) {
    const current = byPlayer.get(rating.playerId);

    if (!current) {
      byPlayer.set(rating.playerId, {
        playerId: rating.playerId,
        total: rating.rating,
        count: 1,
        latestAt: rating.createdAt,
      });
      continue;
    }

    current.total += rating.rating;
    current.count += 1;
    if (new Date(rating.createdAt).getTime() > new Date(current.latestAt).getTime()) {
      current.latestAt = rating.createdAt;
    }
  }

  return (
    [...byPlayer.values()]
      .map((item) => ({ ...item, average: item.total / item.count }))
      .sort((a, b) => {
        if (b.average !== a.average) return b.average - a.average;
        if (b.count !== a.count) return b.count - a.count;
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
      })[0] ?? null
  );
}

export function fanPogPlayerIdForSet(
  setId: string,
  winnerTeamId: string | null | undefined,
  fanRatings: FanRatingForPog[],
) {
  if (!winnerTeamId) return null;

  return (
    fanRatingLeader(
      fanRatings.filter(
        (rating) => rating.setId === setId && rating.teamId === winnerTeamId,
      ),
    )?.playerId ?? null
  );
}
