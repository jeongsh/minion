import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FanCalendarSubmissionForm } from "@/components/fan/fan-calendar-submission-form";
import { FanScheduleCalendar } from "@/components/fan/fan-schedule-calendar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCalendarPageData } from "@/lib/calendar/page-data";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getTeamByRouteKey } from "@/lib/team-themes";

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

  const [calendar, currentUser] = await Promise.all([getCalendarPageData(undefined, team.id), getCurrentUser()]);
  const initialMonthKey = calendar.monthKey;

  return (
    <main className="fan-calendar-page fan-page-shell w-full text-[var(--ui-ink)]">
      <div className="fan-page-container py-2 md:py-3">
        <FanScheduleCalendar
          initialMonthKey={initialMonthKey}
          teamId={team.id}
          matches={calendar.fanMatches}
          events={calendar.events}
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
