import { getCalendarPageData } from "@/lib/calendar/page-data";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const teamId = query.get("team") ?? undefined;
  if (teamId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) return Response.json({ error: "잘못된 팀입니다." }, { status: 400 });
  try {
    const data = await getCalendarPageData(query.get("month"), teamId);
    return Response.json({ monthKey: data.monthKey, homeMatches: data.homeMatches, fanMatches: data.fanMatches, events: data.events }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } });
  } catch (error) {
    console.error("[calendar]", error);
    return Response.json({ error: "일정을 불러오지 못했습니다." }, { status: 500 });
  }
}
