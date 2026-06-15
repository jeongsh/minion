import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getFanRatings, getPlayers, getTeams } from "@/lib/data/lck";
import { teamLabel } from "@/lib/view-data";

export default async function FanRatingsPage() {
  const [fanRatings, players, teams] = await Promise.all([
    getFanRatings(),
    getPlayers(),
    getTeams(),
  ]);
  const rows = players
    .map((player) => {
      const ratings = fanRatings.filter((rating) => rating.playerId === player.id);
      const avg =
        ratings.length === 0
          ? "-"
          : (ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length).toFixed(1);

      return {
        player,
        avg,
        count: ratings.length,
      };
    })
    .sort((a, b) => Number(b.avg === "-" ? 0 : b.avg) - Number(a.avg === "-" ? 0 : a.avg));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title="팬 평점 랭킹" />
      <DataTable
        rows={rows}
        columns={[
          { key: "rank", label: "순위", render: (row) => rows.indexOf(row) + 1 },
          {
            key: "player",
            label: "선수",
            render: (row) => <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link>,
          },
          { key: "team", label: "팀", render: (row) => teamLabel(teams, row.player.teamId) },
          { key: "position", label: "포지션", render: (row) => row.player.position },
          { key: "rating", label: "평점 평균", render: (row) => row.avg },
          { key: "count", label: "평점 수", render: (row) => row.count },
        ]}
      />
    </main>
  );
}
