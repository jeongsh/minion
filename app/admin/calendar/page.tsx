import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import { getFanCalendarEvents } from "@/lib/calendar/events";
import { CalendarEventManager } from "./calendar-event-manager";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const [events, teams, players] = await Promise.all([
    getFanCalendarEvents(),
    getTeamsSortedByRank(),
    getPlayers(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "기념일 관리" }]} />
        <SectionHeader title="기념일 관리" />
        <p className="text-sm text-[var(--ui-muted)]">
          데뷔·우승·커스텀 기념일을 등록합니다. 선수 생일은 선수 정보의 생년월일에서 자동 표시돼요.
        </p>
      </div>
      <CalendarEventManager
        events={events}
        teams={teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))}
        players={players.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId }))}
      />
    </main>
  );
}
