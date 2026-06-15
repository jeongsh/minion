import { notFound } from "next/navigation";
import { MatchCard } from "@/components/domain/match-card";
import { SectionHeader } from "@/components/layout/section-header";
import { getMatches, getTeamByFanSiteHost, getTeamBySlug, getTeams } from "@/lib/data/lck";

export default async function FanMatchesPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
  const teamMatches = matches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={team.shortName} title="팀 경기" />
      <section className="page-grid">
        {teamMatches.map((match) => (
          <MatchCard key={match.id} match={match} teams={teams} />
        ))}
      </section>
    </main>
  );
}
