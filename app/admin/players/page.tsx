import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import {
  getChallengersPlayers,
  getPlayerCareerHistories,
  getPlayers,
  getRetiredPlayers,
  getTeamsSortedByRank,
} from "@/lib/data/lck";
import { PlayerList } from "./player-list";

export default async function AdminPlayersPage({ searchParams }: { searchParams: Promise<{ division?: string }> }) {
  const params = await searchParams;
  const division = params.division === "challengers" ? "challengers" : "first";
  const [players, retiredPlayers, challengersPlayers, teams] = await Promise.all([
    division === "first" ? getPlayers() : Promise.resolve([]),
    division === "first" ? getRetiredPlayers() : Promise.resolve([]),
    division === "challengers" ? getChallengersPlayers() : Promise.resolve([]),
    getTeamsSortedByRank(),
  ]);

  const allPlayerIds = [
    ...players.map((p) => p.id),
    ...retiredPlayers.map((p) => p.id),
    ...challengersPlayers.map((p) => p.id),
  ];
  const careerHistories = await getPlayerCareerHistories(allPlayerIds);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "선수 관리" }]} />
        <SectionHeader title="선수 관리" />
      </div>
      <PlayerList
        division={division}
        players={players}
        retiredPlayers={retiredPlayers}
        challengersPlayers={challengersPlayers}
        teams={teams}
        careerHistories={careerHistories}
      />
    </main>
  );
}
