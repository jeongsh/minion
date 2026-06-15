import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import { PlayerList } from "./player-list";

export default async function AdminPlayersPage() {
  const [players, teams] = await Promise.all([getPlayers(), getTeamsSortedByRank()]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="선수 관리" />
      <PlayerList players={players} teams={teams} />
    </main>
  );
}
