import { GET as getWebLiveMatch } from "@/app/api/matches/[matchId]/live/route";
import { mobileSuccess } from "@/lib/mobile/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const response = await getWebLiveMatch(request, context);
  const data = await response.json();
  return mobileSuccess(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
}
