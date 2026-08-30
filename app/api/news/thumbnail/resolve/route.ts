import { NextRequest } from "next/server";
import { resolveNewsThumbnail } from "@/lib/data/naver-news";
import { isSafePublicNewsUrl } from "@/lib/data/news-thumbnail";

export const runtime = "nodejs";
export const revalidate = 21600;

// 기사 원문 URL → 썸네일 프록시 경로. 목록 응답에서 분리해 렌더 후 지연 로드한다.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!isSafePublicNewsUrl(url)) {
    return Response.json({ thumbnail: null }, { status: 400 });
  }

  const thumbnail = (await resolveNewsThumbnail(url)) ?? null;
  return Response.json(
    { thumbnail },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
      },
    },
  );
}
