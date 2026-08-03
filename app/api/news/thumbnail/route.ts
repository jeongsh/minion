import { NextRequest } from "next/server";
import { isSafePublicNewsUrl, verifyNewsThumbnailSignature } from "@/lib/data/news-thumbnail";

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

    return new Response(body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
