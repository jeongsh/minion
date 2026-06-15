import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getSets, getTeams } from "@/lib/data/lck";
import { buildTeamStandingRows, buildTeamStatSummary } from "@/lib/view-data";

export default async function TeamStatsPage() {
  const [teams, matches, sets] = await Promise.all([getTeams(), getMatches(), getSets()]);
  const rows = buildTeamStandingRows(teams, matches, sets).map((standing) => ({
    ...standing,
    stats: buildTeamStatSummary(standing.team.id, sets),
  }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title="팀 스탯" />
      <DataTable
        rows={rows}
        columns={[
          {
            key: "team",
            label: "팀명",
            render: (row) => <Link href={`/teams/${row.team.slug}`}>{row.team.name}</Link>,
          },
          { key: "win", label: "승률", render: (row) => row.winRate },
          { key: "match", label: "매치 전적", render: (row) => row.matchRecord },
          { key: "set", label: "세트 전적", render: (row) => row.setRecord },
          { key: "kills", label: "평균 킬", render: (row) => row.stats.avgKills.toFixed(1) },
          { key: "deaths", label: "평균 데스", render: (row) => row.stats.avgDeaths.toFixed(1) },
          { key: "gold", label: "평균 골드", render: (row) => row.stats.avgGold.toLocaleString("ko-KR") },
          { key: "tower", label: "평균 타워", render: (row) => row.stats.avgTowers },
        ]}
      />
    </main>
  );
}
