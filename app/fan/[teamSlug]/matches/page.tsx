import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FanCalendarSubmissionForm } from "@/components/fan/fan-calendar-submission-form";
import { FanScheduleCalendar, type FanScheduleMatch } from "@/components/fan/fan-schedule-calendar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCalendarEvents } from "@/lib/calendar/events";
import { getAllTeams, getMatches, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { shouldUseWhiteLogoOnDark } from "@/lib/team-logos";
import { getTeamByRouteKey } from "@/lib/team-themes";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}): Promise<Metadata> {
  const { teamSlug } = await params;
  const fanSlug = getTeamByRouteKey(teamSlug)?.fanSiteHost ?? teamSlug;
  return { title: "경기 일정", alternates: { canonical: `/fan/${fanSlug}/matches` } };
}

export default async function FanSchedulePage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const [teams, matches, calendarEvents, currentUser] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getCalendarEvents({ teamId: team.id, includePastOneTime: true }),
    getCurrentUser(),
  ]);
  const teamById = new Map(teams.map((item) => [item.id, item]));
  const calendarMatches: FanScheduleMatch[] = matches
    .filter((match) => match.teamAId === team.id || match.teamBId === team.id)
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    .map((match) => {
      const opponent = teamById.get(match.teamAId === team.id ? match.teamBId : match.teamAId);

      return {
        id: match.id,
        dateKey: dateKeyKST(match.matchDate),
        href: matchHref(match),
        time: formatTimeKST(match.matchDate),
        opponentName: opponent?.shortName || opponent?.name || "TBD",
        opponentLogoUrl: opponent?.logoUrl ?? null,
        opponentLogoDarkUrl: shouldUseWhiteLogoOnDark(opponent) ? opponent?.logoWhiteUrl : null,
      };
    });
  const initialMonthKey = dateKeyKST(new Date()).slice(0, 7);

  return (
    <main className="fan-calendar-page fan-page-shell w-full text-[var(--ui-ink)]">
      <div className="fan-page-container py-2 md:py-3">
        <FanScheduleCalendar
          initialMonthKey={initialMonthKey}
          matches={calendarMatches}
          events={calendarEvents}
          action={(
            <FanCalendarSubmissionForm
              key="fan-calendar-submission"
              teamId={team.id}
              teamSlug={teamSlug}
              teamName={team.shortName}
              isAuthenticated={Boolean(currentUser)}
            />
          )}
        />
      </div>
    </main>
  );
}
