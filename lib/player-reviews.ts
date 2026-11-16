import type { PlayerReviewCursor } from "@/lib/data/lck";
import type { FanRating, Match, SetResult } from "@/lib/types";
import { setRatingHref } from "@/lib/view-data";

export type FanReviewItem = { rating: FanRating; meta: string[]; href: string | null };
export type FanReviewPage = { items: FanReviewItem[]; nextCursor: PlayerReviewCursor | null };

export function parsePlayerReviewCursor(raw: string | null): PlayerReviewCursor | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (typeof value?.id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id)
    || typeof value.createdAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.createdAt)
    || Number.isNaN(Date.parse(value.createdAt))) throw new Error("Invalid cursor");
  return { id: value.id, createdAt: value.createdAt };
}

export function playerReviewItems(ratings: FanRating[], matches: Match[], sets: SetResult[]): FanReviewItem[] {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const setById = new Map(sets.map((set) => [set.id, set]));
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  });
  return ratings.map((rating) => {
    const match = matchById.get(rating.matchId);
    const set = setById.get(rating.setId);
    const date = new Date(rating.createdAt);
    return {
      rating,
      href: match && set ? setRatingHref(match, set) : null,
      meta: [Number.isNaN(date.getTime()) ? rating.createdAt : formatter.format(date), match?.name, set ? `${set.setNumber}세트` : null]
        .filter((part): part is string => Boolean(part)),
    };
  });
}
