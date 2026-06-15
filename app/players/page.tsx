import { PlayerCard } from "@/components/domain/player-card";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers } from "@/lib/data/lck";

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="선수" title="선수 목록" />
      <section className="page-grid">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
      </section>
    </main>
  );
}
