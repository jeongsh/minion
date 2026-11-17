"use server";
import { getPlayerHistoryPage } from "@/lib/data/player-history";
import { parsePlayerReviewCursor } from "@/lib/player-reviews";

export async function loadPlayerHistory(playerSlug: string, segment: string, rawCursor: string | null) {
  const cursor = parsePlayerReviewCursor(rawCursor);
  const page = await getPlayerHistoryPage(playerSlug, segment, cursor);
  if (!page) throw new Error("선수를 찾을 수 없습니다.");
  return { rows: page.rows, spellsByVersion: page.spellsByVersion, runeCatalogByVersion: page.runeCatalogByVersion, nextCursor: page.nextCursor };
}
