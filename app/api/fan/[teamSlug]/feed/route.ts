import { NextResponse } from "next/server";
import { getMediaPage } from "@/lib/fan/media-feed";

export async function GET(request: Request, { params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const query = new URL(request.url).searchParams;
  const kind = query.get("kind");
  const team = Number(query.get("team") ?? 0);
  const player = Number(query.get("player") ?? 0);
  if ((kind !== "videos" && kind !== "instagram") || ![team, player].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 100000)) return NextResponse.json({ error: "요청을 확인해 주세요." }, { status: 400 });
  try {
    return NextResponse.json(await getMediaPage(teamSlug, kind, query.get("owner") ?? "all", { team, player }), { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("Fan media feed unavailable", error);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}
