import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceNotice } from "@/components/domain/source-notice";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import {
  getFanRatings,
  getMatches,
  getPlayerAwards,
  getPlayerBySlug,
  getPlayerPomCount,
  getPlayerStatLines,
  getPlayers,
  getTeams,
  getTournaments,
} from "@/lib/data/lck";
import type { TeamAward } from "@/lib/types";
import { calculatePlayerStats } from "@/lib/stats";
import { buildPlayerSummary, formatDateTime, teamLabel } from "@/lib/view-data";

const PLAYER_AWARD_META: Record<string, { label: string; icon: string; style: string }> = {
  lck_finals_mvp: { label: "LCK Finals MVP", icon: "🏅", style: "bg-yellow-500 text-white border-yellow-600" },
  worlds_mvp:     { label: "Worlds MVP",      icon: "🌍", style: "bg-amber-500 text-white border-amber-600" },
  msi_mvp:        { label: "MSI MVP",         icon: "⭐", style: "bg-sky-500 text-white border-sky-600" },
  all_lck_first:  { label: "All-LCK 1팀",    icon: "✨", style: "bg-emerald-500 text-white border-emerald-600" },
  all_lck_second: { label: "All-LCK 2팀",    icon: "✨", style: "bg-teal-500 text-white border-teal-600" },
  rookie_of_year: { label: "신인상",          icon: "🌱", style: "bg-pink-500 text-white border-pink-600" },
};

function PlayerAwardHistory({ awards }: { awards: TeamAward[] }) {
  if (awards.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {awards.map((award, i) => {
        const meta = PLAYER_AWARD_META[award.awardType];
        return (
          <div
            key={award.id}
            className={`flex items-center gap-4 px-5 py-3.5 ${i !== 0 ? "border-t border-border" : ""}`}
          >
            <span className="w-10 shrink-0 text-sm font-bold tabular-nums text-foreground">
              {award.year}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${meta?.style ?? "bg-surface border-border text-foreground"}`}
            >
              <span>{meta?.icon}</span>
              {meta?.label ?? award.awardType}
            </span>
            <span className="text-sm text-muted">{award.tournamentName}</span>
          </div>
        );
      })}
    </div>
  );
}

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

  const [teams, players, matches, statLines, fanRatings, awards, pomCount, tournaments] = await Promise.all([
    getTeams(),
    getPlayers(),
    getMatches(),
    getPlayerStatLines(),
    getFanRatings(),
    getPlayerAwards(player.name, player.id),
    getPlayerPomCount(player.id),
    getTournaments(),
  ]);

  const latestSeason = Math.max(...tournaments.map((t) => t.season));
  const currentSeasonIds = new Set(
    tournaments.filter((t) => t.season === latestSeason).map((t) => t.id),
  );
  const currentSeasonMatches = matches.filter((m) => currentSeasonIds.has(m.tournamentId));

  const summary = buildPlayerSummary({
    player,
    teams,
    players,
    playerStatLines: statLines,
    fanRatings,
    matches: currentSeasonMatches,
  });
  const derived = summary.stats;
  const teamMatches = currentSeasonMatches.filter(
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
        <StatCard label="공식 POM" value={pomCount} />
      </section>

      {awards.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="player-awards">
          <h2 id="player-awards" className="text-xl font-semibold">수상 내역</h2>
          <PlayerAwardHistory awards={awards} />
        </section>
      )}

      {(() => {
        const pomMatches = teamMatches
          .filter((m) => m.officialPomPlayerId === player.id)
          .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
        if (pomMatches.length === 0) return null;
        return (
          <section className="flex flex-col gap-4" aria-labelledby="pom-history">
            <h2 id="pom-history" className="text-xl font-semibold">
              공식 POM 선정 내역{" "}
              <span className="text-base font-normal text-muted">({pomMatches.length}회)</span>
            </h2>
            <DataTable
              rows={pomMatches}
              columns={[
                { key: "date", label: "경기 일시", render: (row) => formatDateTime(row.matchDate) },
                { key: "match", label: "경기", render: (row) => <Link href={`/matches/${row.id}`}>{row.name}</Link> },
                {
                  key: "opponent",
                  label: "상대팀",
                  render: (row) => teamLabel(teams, row.teamAId === player.teamId ? row.teamBId : row.teamAId),
                },
                {
                  key: "result",
                  label: "결과",
                  render: (row) =>
                    row.teamAScore === null || row.teamBScore === null
                      ? row.status
                      : `${row.teamAScore}:${row.teamBScore}`,
                },
              ]}
            />
          </section>
        );
      })()}

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
            { key: "link", label: "이동", render: (row) => <Link href={`/matches/${row.id}`}>경기 상세</Link> },
          ]}
        />
      </section>

      <SourceNotice />
    </main>
  );
}
