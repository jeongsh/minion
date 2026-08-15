import { PlayerDirectory } from "@/components/domain/player-directory";
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
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide pb-16 pt-6 sm:pt-8">
        <h1 className="sr-only">선수</h1>
        <PlayerDirectory teams={teams} players={activePlayers} challengersPlayers={activeChallengersPlayers} />
      </div>
    </main>
  );
}
