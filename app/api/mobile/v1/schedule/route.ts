import type { MobileScheduleDto } from "@/packages/contracts/src/mobile-v1";
import { getCalendarEvents } from "@/lib/calendar/events";
import { getAllTeams, getMatchesByMonth, getTournaments } from "@/lib/data/lck";
import { mobileSuccess, toMobileMatch } from "@/lib/mobile/api-response";
import { filterMatchesBySegment, parseSeasonSegment } from "@/lib/tournament-filters";
import { getMonthKST, getYearKST } from "@/lib/view-data";

export const revalidate = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const now = new Date().toISOString();
  const currentYear = getYearKST(now);
  const currentMonth = getMonthKST(now);
  const requestedYear = Number(params.get("year"));
  const requestedMonth = Number(params.get("month"));
  const queryYear = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : currentYear;
  const activeMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : currentMonth;
  // Older app builds expect calendar events in the default response. Newer
  // builds opt out on initial entry and request them only when the dialog opens.
  const includeCalendar = params.get("calendar") !== "0";
  const [matches, teams, tournaments, calendarEvents] = await Promise.all([
    getMatchesByMonth(queryYear, activeMonth),
    getAllTeams(),
    getTournaments(),
    includeCalendar ? getCalendarEvents({ includePastOneTime: true }) : Promise.resolve([]),
  ]);
  const years = Array.from(new Set(tournaments.map((item) => item.season))).sort((a, b) => b - a);
  const activeYear = years.includes(queryYear) ? queryYear : (years.includes(currentYear) ? currentYear : years[0] ?? currentYear);
  const activeMatches = activeYear === queryYear ? matches : await getMatchesByMonth(activeYear, activeMonth);
  const activeSegment = parseSeasonSegment(params.get("segment") ?? undefined);
  const activeTeamId = params.get("team");
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const filtered = filterMatchesBySegment(activeMatches, tournaments, activeSegment, activeYear)
    .filter((match) => !activeTeamId || match.teamAId === activeTeamId || match.teamBId === activeTeamId)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());
  const data: MobileScheduleDto = {
    calendarEvents: calendarEvents
      .filter((event) => !activeTeamId || event.teamId === activeTeamId)
      .map((event) => ({
        date: event.nextDateKey,
        dday: event.dday,
        id: event.key,
        image: event.playerImageUrl ? { url: event.playerImageUrl } : event.teamLogoUrl ? { url: event.teamLogoUrl } : null,
        isRecurring: event.isRecurring,
        monthDay: event.monthDay,
        title: event.title,
        type: event.type,
        eventTime: event.eventTime,
        sourceUrl: event.sourceUrl,
      })),
    filters: { activeMonth, activeSegment, activeTeamId, activeYear, years },
    matches: filtered.map((match) => toMobileMatch(match, teamMap, tournamentMap)),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
