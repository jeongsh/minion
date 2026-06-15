import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getPlayerStatLines, getPlayers, getTeams } from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { teamLabel } from "@/lib/view-data";

export default async function PlayerStatsPage() {
  const [statLines, players, teams] = await Promise.all([
    getPlayerStatLines(),
    getPlayers(),
    getTeams(),
  ]);
  const rows = statLines.map((line) => {
    const player = players.find((item) => item.id === line.playerId);
    return {
      line,
      player,
      stats: calculatePlayerStats(line),
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title="선수 스탯" />
      <DataTable
        rows={rows}
        columns={[
          {
            key: "player",
            label: "선수",
            render: (row) =>
              row.player ? <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link> : "-",
          },
          { key: "team", label: "팀", render: (row) => teamLabel(teams, row.line.teamId) },
          { key: "position", label: "포지션", render: (row) => row.line.position },
          { key: "kda", label: "KDA", render: (row) => row.stats.kda },
          { key: "kp", label: "KP%", render: (row) => `${row.stats.kp}%` },
          { key: "dpm", label: "DPM", render: (row) => row.stats.dpm },
          { key: "dmg", label: "DMG%", render: (row) => `${row.stats.dmgPercent}%` },
          { key: "csm", label: "CSM", render: (row) => row.stats.csm },
          { key: "gpm", label: "GPM", render: (row) => row.stats.gpm },
          { key: "vision", label: "Vision", render: (row) => row.stats.visionScoreAvg },
        ]}
      />
    </main>
  );
}
