import type { MobileSearchDto } from "@/packages/contracts/src/mobile-v1";
import { mobileSuccess } from "@/lib/mobile/api-response";
import { getSearchResults } from "@/lib/search";

export const revalidate = 30;

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const results = (await getSearchResults(query)).map(({ imageUrl, ...result }) => ({
    ...result,
    image: imageUrl ? { url: imageUrl } : null,
  }));
  return mobileSuccess<MobileSearchDto>({ query, results }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" } });
}
