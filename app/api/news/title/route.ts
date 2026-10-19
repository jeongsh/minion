import { NextRequest } from "next/server";
import { resolveNewsTitle } from "@/lib/data/news-thumbnail-cache";
import { isSafePublicNewsUrl } from "@/lib/data/news-thumbnail";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!isSafePublicNewsUrl(url)) {
    return Response.json({ title: null }, { status: 400 });
  }
  try {
    const title = await resolveNewsTitle(url);
    return Response.json({ title }, {
      headers: { "Cache-Control": title
        ? "public, max-age=21600, s-maxage=21600"
        : "public, max-age=60, s-maxage=60" },
    });
  } catch {
    return Response.json({ title: null }, { status: 502 });
  }
}
