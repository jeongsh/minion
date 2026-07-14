import { PlayerDirectory } from "@/components/domain/player-directory";
import { PageHeader } from "@/components/ui/page-header";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";

export default async function PlayersPage() {
  const [teams, players] = await Promise.all([getTeamsSortedByRank(), getPlayers()]);
  const activePlayers = players.filter((player) => player.teamId && teams.some((team) => team.id === player.teamId));

  return (
    <main className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <div className="layout-wide pb-16 pt-6 sm:pt-8">
        <PageHeader title="선수" action={<p className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-[13px] font-bold text-[var(--ui-muted)]">{activePlayers.length}명</p>} />
        <PlayerDirectory teams={teams} players={activePlayers} />
      </div>
    </main>
  );
}
