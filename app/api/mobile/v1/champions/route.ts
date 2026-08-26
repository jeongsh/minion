import { mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileChampions } from "@/lib/mobile/champion-page";

export const revalidate = 300;

export async function GET(request: Request) {
  const data = await getMobileChampions(new URL(request.url).searchParams);
  return mobileSuccess(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" },
  });
}
