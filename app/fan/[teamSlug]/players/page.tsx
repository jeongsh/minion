import { notFound } from "next/navigation";
import { PlayerCard } from "@/components/domain/player-card";
import { FanPageShell } from "@/components/fan/fan-page-shell";
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
    <FanPageShell>
      <section className="page-grid">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </section>
    </FanPageShell>
  );
}
