import { NextResponse } from "next/server";
import { getPlayerReviewFeed } from "@/lib/data/player-review-feed";
import { parsePlayerReviewCursor } from "@/lib/player-reviews";

export async function GET(request: Request, { params }: { params: Promise<{ playerSlug: string }> }) {
  const query = new URL(request.url).searchParams;
  let cursor;
  try {
    cursor = parsePlayerReviewCursor(query.get("cursor"));
  } catch {
    return NextResponse.json({ error: "리뷰 조회 위치가 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const { playerSlug } = await params;
    const page = await getPlayerReviewFeed(playerSlug, query.get("segment") ?? "all", cursor);
    if (!page) return NextResponse.json({ error: "선수를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(page);
  } catch (error) {
    console.error("[player-reviews]", error);
    return NextResponse.json({ error: "리뷰를 불러오지 못했습니다." }, { status: 500 });
  }
}
