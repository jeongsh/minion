import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceNotice } from "@/components/domain/source-notice";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import {
  getFanRatings,
  getMatches,
  getPlayerBySlug,
  getPlayerStatLines,
  getPlayers,
  getTeams,
} from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import { buildPlayerSummary, formatDateTime, teamLabel } from "@/lib/view-data";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ playerSlug: string }>;
}) {
  const { playerSlug } = await params;
  const player = await getPlayerBySlug(playerSlug);

  if (!player) {
    notFound();
  }

  const [teams, players, matches, statLines, fanRatings] = await Promise.all([
    getTeams(),
    getPlayers(),
    getMatches(),
    getPlayerStatLines(),
    getFanRatings(),
  ]);
  const summary = buildPlayerSummary({
    player,
    teams,
    players,
    playerStatLines: statLines,
    fanRatings,
    matches,
  });
  const derived = summary.stats;
  const teamMatches = matches.filter(
    (match) => match.teamAId === player.teamId || match.teamBId === player.teamId,
  );
  const positionRows = statLines
    .filter((line) => line.position === player.position)
    .map((line) => {
      const rowPlayer = players.find((item) => item.id === line.playerId);
      return {
        line,
        player: rowPlayer,
        stats: calculatePlayerStats(line),
      };
    })
    .sort((a, b) => b.stats.formScore - a.stats.formScore);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={`${teamLabel(teams, player.teamId)} · ${player.position}`} title={player.name} />

      <section className="page-grid" aria-label="선수 요약">
        <StatCard label="선수명" value={player.name} helper={player.realName} />
        <StatCard label="소속팀" value={summary.team?.name ?? "-"} />
        <StatCard label="포지션" value={player.position} />
        <StatCard label="팬 평점 평균" value={summary.avgFanRating} />
        <StatCard label="팬 POG 집계" value={summary.fanPogCount} />
        <StatCard label="공식 POM" value={summary.officialPomCount} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="current-stats">
        <h2 id="current-stats" className="text-xl font-semibold">
          현재 스탯
        </h2>
        <div className="page-grid">
          <StatCard label="KDA" value={derived?.kda ?? "-"} />
          <StatCard label="KP%" value={derived ? `${derived.kp}%` : "-"} />
          <StatCard label="DPM" value={derived?.dpm ?? "-"} />
          <StatCard label="DMG%" value={derived ? `${derived.dmgPercent}%` : "-"} />
          <StatCard label="CSM" value={derived?.csm ?? "-"} />
          <StatCard label="GPM" value={derived?.gpm ?? "-"} />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="lane-ranking">
        <h2 id="lane-ranking" className="text-xl font-semibold">
          같은 포지션 비교
        </h2>
        <DataTable
          rows={positionRows}
          columns={[
            {
              key: "player",
              label: "선수",
              render: (row) =>
                row.player ? <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link> : "-",
            },
            { key: "team", label: "팀", render: (row) => teamLabel(teams, row.line.teamId) },
            { key: "kda", label: "KDA", render: (row) => row.stats.kda },
            { key: "dpm", label: "DPM", render: (row) => row.stats.dpm },
            { key: "gpm", label: "GPM", render: (row) => row.stats.gpm },
            { key: "form", label: "폼 점수", render: (row) => row.stats.formScore },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="recent-matches">
        <h2 id="recent-matches" className="text-xl font-semibold">
          팀 경기 기록
        </h2>
        <DataTable
          rows={teamMatches}
          columns={[
            { key: "date", label: "경기 일시", render: (row) => formatDateTime(row.matchDate) },
            {
              key: "opponent",
              label: "상대팀",
              render: (row) => teamLabel(teams, row.teamAId === player.teamId ? row.teamBId : row.teamAId),
            },
            {
              key: "result",
              label: "매치 결과",
              render: (row) =>
                row.teamAScore === null || row.teamBScore === null
                  ? row.status
                  : `${row.teamAScore}:${row.teamBScore}`,
            },
            {
              key: "pom",
              label: "공식 POM",
              render: (row) => row.officialPomPlayerId === player.id ? "선정" : "-",
            },
            { key: "link", label: "이동", render: (row) => <Link href={`/matches/${row.id}`}>경기 상세</Link> },
          ]}
        />
      </section>

      <SourceNotice />
    </main>
  );
}
