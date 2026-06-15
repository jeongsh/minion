import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayers, getTeams } from "@/lib/data/lck";
import { teamLabel } from "@/lib/view-data";

export default async function PomPage() {
  const [matches, players, teams] = await Promise.all([getMatches(), getPlayers(), getTeams()]);
  const rows = players
    .map((player) => ({
      player,
      officialPomCount: matches.filter((match) => match.officialPomPlayerId === player.id).length,
    }))
    .filter((row) => row.officialPomCount > 0)
    .sort((a, b) => b.officialPomCount - a.officialPomCount);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title="공식 POM 랭킹" />
      <DataTable
        rows={rows}
        emptyText="공식 POM 데이터가 아직 없습니다."
        columns={[
          { key: "rank", label: "순위", render: (row) => rows.indexOf(row) + 1 },
          {
            key: "player",
            label: "선수",
            render: (row) => <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link>,
          },
          { key: "team", label: "팀", render: (row) => teamLabel(teams, row.player.teamId) },
          { key: "position", label: "포지션", render: (row) => row.player.position },
          { key: "pom", label: "공식 POM 횟수", render: (row) => row.officialPomCount },
        ]}
      />
    </main>
  );
}
