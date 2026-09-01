import { NextRequest } from "next/server";
import { resolveNewsThumbnail } from "@/lib/data/naver-news";
import { isSafePublicNewsUrl } from "@/lib/data/news-thumbnail";

export const runtime = "nodejs";
export const revalidate = 21600;

// 기사 원문 URL → 영구 R2 썸네일 URL. 최초 요청만 생성하고 이후에는 CDN URL을 재사용한다.
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
        "Cache-Control": thumbnail
          ? "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400"
          : "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
