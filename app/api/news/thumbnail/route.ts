import { NextRequest } from "next/server";
import { isSafePublicNewsUrl, verifyNewsThumbnailSignature } from "@/lib/data/news-thumbnail";
import { resizeImageForWeb } from "@/lib/images/resize-for-web";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function fetchImage(value: string, redirects = 0): Promise<Response | null> {
  if (!isSafePublicNewsUrl(value) || redirects > 3) return null;

  const response = await fetch(value, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; MINION-News/1.0)",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(6000),
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) return null;
    return fetchImage(new URL(location, value).toString(), redirects + 1);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (!response.ok || !contentType.startsWith("image/") || contentLength > MAX_IMAGE_BYTES) return null;
  return response;
}

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url") ?? "";
  const signature = request.nextUrl.searchParams.get("sig") ?? "";
  if (!isSafePublicNewsUrl(value) || !verifyNewsThumbnailSignature(value, signature)) {
    return new Response(null, { status: 403 });
  }

  try {
    const upstream = await fetchImage(value);
    if (!upstream) return new Response(null, { status: 404 });
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return new Response(null, { status: 413 });

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    // 언론사 원본 사진은 뉴스 카드에 표시되는 크기보다 훨씬 큰 경우가 많아,
    // 캐시에 얹기 전에 카드용 크기로 한 번 줄인다(캐시 헤더가 있어 재변환은 드묾).
    const resized = await resizeImageForWeb(Buffer.from(body), contentType, { maxEdge: 640 });

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
