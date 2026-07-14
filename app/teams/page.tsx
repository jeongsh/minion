import { TeamCard } from "@/components/domain/team-card";
import { PageHeader } from "@/components/ui/page-header";
import { getTeamsSortedByRank } from "@/lib/data/lck";

export default async function TeamsPage() {
  const teams = await getTeamsSortedByRank();

  return (
    <main className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <div className="layout-wide pb-20 pt-6 sm:pt-10">
        <PageHeader
          eyebrow="LCK TEAMS"
          title="팀"
          action={
            <span className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-[13px] font-black text-[var(--ui-muted)]">
              {teams.length}팀
            </span>
          }
        />

        <section className="mt-8 sm:mt-10">
          {teams.length ? (
            <div className="grid gap-3 md:grid-cols-2 min-[1200px]:grid-cols-3">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-[var(--ui-card-radius)] bg-[var(--ui-surface-muted)] px-6 text-center text-sm font-semibold text-[var(--ui-muted)]">
              등록된 팀이 없습니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
