import "server-only";
import { getAllTeams, getMatchesForScope } from "@/lib/data/lck";
import { getCalendarEvents } from "@/lib/calendar/events";
import { calendarMonthRange } from "@/lib/calendar/range";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { shouldUseWhiteLogoOnDark } from "@/lib/team-logos";

export async function getCalendarPageData(rawMonth?: string | null, teamId?: string) {
  const range = calendarMonthRange(rawMonth);
  const [matches, teams, events] = await Promise.all([
    getMatchesForScope({ from: range.from, to: range.to, ...(teamId ? { teamIds: [teamId] } : {}) }),
    getAllTeams(),
    getCalendarEvents({ teamId, includePastOneTime: true, dateRange: range.eventRange }),
  ]);
  const byId = new Map(teams.map(team => [team.id, team]));
  return {
    monthKey: range.monthKey, matches, teams, events,
    homeMatches: matches.map(match => {
      const a = byId.get(match.teamAId), b = byId.get(match.teamBId);
      return {
        id: match.id, dateKey: dateKeyKST(match.matchDate), href: matchHref(match), time: formatTimeKST(match.matchDate), league: "",
        teamAName: a?.shortName ?? "TBD", teamBName: b?.shortName ?? "TBD",
        teamALogoUrl: a?.logoUrl ?? null, teamBLogoUrl: b?.logoUrl ?? null,
        teamALogoDarkUrl: shouldUseWhiteLogoOnDark(a) ? a?.logoWhiteUrl : null,
        teamBLogoDarkUrl: shouldUseWhiteLogoOnDark(b) ? b?.logoWhiteUrl : null,
      };
    }),
    fanMatches: matches.map(match => {
      const opponent = byId.get(match.teamAId === teamId ? match.teamBId : match.teamAId);
      return {
        id: match.id, dateKey: dateKeyKST(match.matchDate), href: matchHref(match), time: formatTimeKST(match.matchDate),
        opponentName: opponent?.shortName || opponent?.name || "TBD", opponentLogoUrl: opponent?.logoUrl ?? null,
        opponentLogoDarkUrl: shouldUseWhiteLogoOnDark(opponent) ? opponent?.logoWhiteUrl : null,
      };
    }),
  };
}
