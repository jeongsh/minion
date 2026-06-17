import { SectionHeader } from "@/components/layout/section-header";
import { getPlayerCareerHistories, getPlayers, getRetiredPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import { PlayerList } from "./player-list";

export default async function AdminPlayersPage() {
  const [players, retiredPlayers, teams] = await Promise.all([
    getPlayers(),
    getRetiredPlayers(),
    getTeamsSortedByRank(),
  ]);

  const allPlayerIds = [
    ...players.map((p) => p.id),
    ...retiredPlayers.map((p) => p.id),
  ];
  const careerHistories = await getPlayerCareerHistories(allPlayerIds);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="선수 관리" />
      <PlayerList
        players={players}
        retiredPlayers={retiredPlayers}
        teams={teams}
        careerHistories={careerHistories}
      />
    </main>
  );
}
