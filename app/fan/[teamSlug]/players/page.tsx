import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/domain/player-card";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanPlayersPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const players = (await getPlayers()).filter((player) => player.teamId === team.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={team.shortName} title="팀 선수 / 방송" />
      <section className="page-grid">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </section>
    </main>
  );
}
