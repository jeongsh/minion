import Link from "next/link";
import { SourceNotice } from "@/components/domain/source-notice";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayerStatLines, getPlayers, getTeams } from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { teamLabel } from "@/lib/view-data";

export default async function FormStatsPage() {
  const [statLines, players, matches, teams] = await Promise.all([
    getPlayerStatLines(),
    getPlayers(),
    getMatches(),
    getTeams(),
  ]);
  const rows = statLines
    .map((line) => {
      const player = players.find((item) => item.id === line.playerId);
      return {
        line,
        player,
        stats: calculatePlayerStats(line),
        officialPomCount: matches.filter((match) => match.officialPomPlayerId === line.playerId).length,
      };
    })
    .filter((row) => row.player)
    .sort((a, b) => b.stats.formScore - a.stats.formScore);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title="최근 폼 랭킹" />
      <DataTable
        rows={rows}
        columns={[
          { key: "rank", label: "순위", render: (row) => rows.indexOf(row) + 1 },
          {
            key: "player",
            label: "선수",
            render: (row) =>
              row.player ? <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link> : "-",
          },
          { key: "team", label: "팀", render: (row) => teamLabel(teams, row.line.teamId) },
          { key: "position", label: "포지션", render: (row) => row.line.position },
          { key: "form", label: "폼 점수", render: (row) => row.stats.formScore },
          { key: "kda", label: "KDA", render: (row) => row.stats.kda },
          { key: "dpm", label: "DPM", render: (row) => row.stats.dpm },
          { key: "gpm", label: "GPM", render: (row) => row.stats.gpm },
          { key: "csm", label: "CSM", render: (row) => row.stats.csm },
          { key: "vision", label: "Vision", render: (row) => row.stats.visionScoreAvg },
          { key: "pom", label: "공식 POM", render: (row) => row.officialPomCount },
        ]}
      />
      <SourceNotice />
    </main>
  );
}
