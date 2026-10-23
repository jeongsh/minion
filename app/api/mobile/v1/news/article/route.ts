import { resolveNewsThumbnail } from "@/lib/data/naver-news";
import { resolveNewsTitle } from "@/lib/data/news-thumbnail-cache";
import { isSafePublicNewsUrl } from "@/lib/data/news-thumbnail";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url") ?? "";
  const kind = params.get("kind");
  if (!isSafePublicNewsUrl(url) || (kind !== "title" && kind !== "thumbnail")) {
    return mobileError("BAD_REQUEST", "올바른 기사 URL과 조회 항목이 필요합니다.", 400);
  }
  try {
    const value = kind === "title" ? await resolveNewsTitle(url) : (await resolveNewsThumbnail(url)) ?? null;
    return mobileSuccess({ [kind]: value }, { headers: { "Cache-Control": value ? "public, max-age=21600, s-maxage=21600" : "public, max-age=60, s-maxage=60" } });
  } catch (error) {
    console.error("[mobile-news-article]", error);
    return mobileError("INTERNAL", "기사 정보를 불러오지 못했습니다.", 502);
  }
}
