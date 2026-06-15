import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getTeamsSortedByRank } from "@/lib/data/lck";

export default async function TeamsPage() {
  const teams = await getTeamsSortedByRank();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="팀" title="LCK 팀 목록" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 transition-colors hover:border-accent hover:bg-surface-muted"
          >
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt={team.name}
                className="h-16 w-16 object-contain"
              />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: team.primaryColor }}
              >
                {team.shortName?.slice(0, 2)}
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-bold leading-tight group-hover:text-accent">
                {team.name}
              </p>
              <p className="mt-0.5 text-xs text-muted">{team.shortName}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
