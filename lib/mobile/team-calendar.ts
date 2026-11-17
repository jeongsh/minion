import { getCalendarPageData } from "@/lib/calendar/page-data";
import { getTournaments } from "@/lib/data/lck";
import { toMobileMatch } from "@/lib/mobile/api-response";
import type { CalendarEvent } from "@/lib/calendar/events";

export function mobileCalendarEvents(events: CalendarEvent[]) {
  return events.map(event => ({
    date: event.nextDateKey, dday: event.dday, id: event.key,
    image: event.playerImageUrl ? { url: event.playerImageUrl } : event.teamLogoUrl ? { url: event.teamLogoUrl } : null,
    isRecurring: event.isRecurring, monthDay: event.monthDay, title: event.title, type: event.type,
    eventTime: event.eventTime, sourceUrl: event.sourceUrl,
  }));
}

export async function getMobileTeamCalendar(teamId: string, month?: string | null) {
  const [data, tournaments] = await Promise.all([getCalendarPageData(month, teamId), getTournaments()]);
  return {
    monthKey: data.monthKey,
    matches: data.matches.map(match => toMobileMatch(match, new Map(data.teams.map(team => [team.id, team])), new Map(tournaments.map(item => [item.id, item])))),
    events: mobileCalendarEvents(data.events),
  };
}
