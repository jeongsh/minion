import type { MobileScheduleDto } from "@/packages/contracts/src/mobile-v1";
import { getCalendarEvents } from "@/lib/calendar/events";
import { getAllTeams, getMatches, getTournaments } from "@/lib/data/lck";
import { mobileSuccess, toMobileMatch } from "@/lib/mobile/api-response";
import { filterMatchesBySegment, parseSeasonSegment } from "@/lib/tournament-filters";
import { getMonthKST, getYearKST } from "@/lib/view-data";

export const revalidate = 60;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const [matches, teams, tournaments, calendarEvents] = await Promise.all([
    getMatches(),
    getAllTeams(),
    getTournaments(),
    getCalendarEvents({ includePastOneTime: true }),
  ]);
  const now = new Date().toISOString();
  const currentYear = getYearKST(now);
  const currentMonth = getMonthKST(now);
  const years = Array.from(new Set(tournaments.map((item) => item.season))).sort((a, b) => b - a);
  const requestedYear = Number(params.get("year"));
  const requestedMonth = Number(params.get("month"));
  const activeYear = years.includes(requestedYear) ? requestedYear : (years.includes(currentYear) ? currentYear : years[0] ?? currentYear);
  const activeMonth = requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : currentMonth;
  const activeSegment = parseSeasonSegment(params.get("segment") ?? undefined);
  const activeTeamId = params.get("team");
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const filtered = filterMatchesBySegment(matches, tournaments, activeSegment, activeYear)
    .filter((match) => getYearKST(match.matchDate) === activeYear && getMonthKST(match.matchDate) === activeMonth)
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
