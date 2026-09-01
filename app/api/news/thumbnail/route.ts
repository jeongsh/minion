import { NextRequest } from "next/server";
import { fetchNewsThumbnailImage } from "@/lib/data/news-thumbnail-cache";
import { isSafePublicNewsUrl, verifyNewsThumbnailSignature } from "@/lib/data/news-thumbnail";
import { resizeImageForWeb } from "@/lib/images/resize-for-web";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url") ?? "";
  const signature = request.nextUrl.searchParams.get("sig") ?? "";
  if (!isSafePublicNewsUrl(value) || !verifyNewsThumbnailSignature(value, signature)) {
    return new Response(null, { status: 403 });
  }

  try {
    const upstream = await fetchNewsThumbnailImage(value);
    if (!upstream) return new Response(null, { status: 404 });
    // 언론사 원본 사진은 뉴스 카드에 표시되는 크기보다 훨씬 큰 경우가 많아,
    // 캐시에 얹기 전에 카드용 크기로 한 번 줄인다(캐시 헤더가 있어 재변환은 드묾).
    const resized = await resizeImageForWeb(upstream.bytes, upstream.contentType, { maxEdge: 640 });

    return new Response(new Uint8Array(resized.bytes), {
      headers: {
        "Content-Type": resized.contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
