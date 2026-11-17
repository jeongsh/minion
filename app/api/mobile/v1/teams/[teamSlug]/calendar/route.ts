import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getMobileTeamCalendar } from "@/lib/mobile/team-calendar";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const team = await getTeamByFanSiteHost(teamSlug).then(team => team ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
  try {
    const data = await getMobileTeamCalendar(team.id, new URL(request.url).searchParams.get("month"));
    return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } });
  } catch (error) {
    console.error("[team-calendar]", error);
    return mobileError("INTERNAL", "일정을 불러오지 못했습니다.", 500);
  }
}
