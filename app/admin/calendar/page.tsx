import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import { getFanCalendarEvents } from "@/lib/calendar/events";
import { listFanCalendarSubmissions } from "@/lib/calendar/submission-admin";
import { CalendarEventManager } from "./calendar-event-manager";
import { CalendarSubmissionManager } from "./calendar-submission-manager";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  const [events, submissions, teams, players] = await Promise.all([
    getFanCalendarEvents(),
    listFanCalendarSubmissions(),
    getTeamsSortedByRank(),
    getPlayers(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "일정·기념일 관리" }]} />
        <SectionHeader title="일정·기념일 관리" />
        <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">
          팬이 제보한 일정을 검토하고, 공식 데뷔·우승·기념일을 직접 관리합니다.
        </p>
      </div>

      <section id="calendar-submissions" className="scroll-mt-24">
        <div className="mb-5 flex flex-col gap-2">
          <h2 className="font-paperozi text-[20px] font-normal text-[var(--ui-ink)]">팬 일정 제보</h2>
          <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">
            출처를 확인한 뒤 승인하면 해당 팀 팬페이지 캘린더에 공개됩니다.
          </p>
        </div>
        <CalendarSubmissionManager submissions={submissions} />
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-2">
          <h2 className="font-paperozi text-[20px] font-normal text-[var(--ui-ink)]">공개 일정 직접 관리</h2>
          <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">
            선수 생일은 선수 정보에서 자동 표시되며, 아래에서는 데뷔·우승·기념일을 직접 등록합니다.
          </p>
        </div>
        <CalendarEventManager
          events={events}
          teams={teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName }))}
          players={players.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId }))}
        />
      </section>
    </main>
  );
}
