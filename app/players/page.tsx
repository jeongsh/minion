import { PlayerDirectory } from "@/components/domain/player-directory";
import { PageHeader } from "@/components/ui/page-header";
import { getChallengersPlayers, getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";

export default async function PlayersPage() {
  const [teams, players, challengersPlayers] = await Promise.all([
    getTeamsSortedByRank(),
    getPlayers(),
    getChallengersPlayers(),
  ]);
  const activePlayers = players.filter((player) => player.teamId && teams.some((team) => team.id === player.teamId));
  const activeChallengersPlayers = challengersPlayers.filter(
    (player) => player.teamId && teams.some((team) => team.id === player.teamId),
  );

  return (
    <main className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <div className="layout-wide pb-16 pt-6 sm:pt-8">
        <PageHeader title="선수" />
        <PlayerDirectory teams={teams} players={activePlayers} challengersPlayers={activeChallengersPlayers} />
      </div>
    </main>
  );
}
