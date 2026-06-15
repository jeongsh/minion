import Link from "next/link";
import { Suspense } from "react";

import { SeasonSegmentFilter } from "@/components/domain/season-segment-filter";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getTeamStandings, getTeams, getTournaments } from "@/lib/data/lck";
import {
  buildTeamStandingRows,
  formatDateTime,
  teamLabel,
} from "@/lib/view-data";
import {
  filterMatchesBySegment,
  filterSetsByMatches,
  parseSeasonSegment,
  segmentLabel,
} from "@/lib/tournament-filters";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const params = await searchParams;
  const activeSegment = parseSeasonSegment(params.segment);

  const [teams, matches, tournaments, savedStandings] = await Promise.all([
    getTeams(),
    getMatches(),
    getTournaments(),
    getTeamStandings(),
  ]);

  // team_standings 데이터가 있으면 그 값 사용, 없으면 매치 계산 폴백
  const useStoredStandings = savedStandings.length > 0;

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const rows = useStoredStandings
    ? savedStandings
        .map((s) => {
          const team = teamMap.get(s.teamId);
          if (!team) return null;

          const teamMatches = matches.filter(
            (m) => m.teamAId === team.id || m.teamBId === team.id,
          );
          const nextMatch = teamMatches
            .filter((m) => m.status !== "completed")
            .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())[0];

          const recent = teamMatches
            .filter((m) => m.status === "completed")
            .slice(-5)
            .map((m) => (m.winnerTeamId === team.id ? "W" : "L"))
            .join("-") || "-";

          return {
            rank: s.rank,
            team,
            matchRecord: `${s.wins}-${s.losses}`,
            winRate: s.winRate != null ? `${Math.round(s.winRate * 100)}%` : "-",
            setDiff: s.setDiff > 0 ? `+${s.setDiff}` : `${s.setDiff}`,
            kda: s.kda != null ? s.kda.toFixed(2) : "-",
            kills: s.kills || "-",
            deaths: s.deaths || "-",
            assists: s.assists ? s.assists.toLocaleString() : "-",
            recent,
            nextMatch,
          };
        })
        .filter((r) => r !== null)
    : buildTeamStandingRows(
        teams,
        filterMatchesBySegment(matches, tournaments, activeSegment),
        filterSetsByMatches([], filterMatchesBySegment(matches, tournaments, activeSegment)),
      ).map((r) => ({
        ...r,
        setDiff: "-",
        kda: "-",
        kills: "-",
        deaths: "-",
        assists: "-",
      }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="순위" title={`${segmentLabel(activeSegment)} 팀 순위표`} />

      {!useStoredStandings && (
        <Suspense fallback={null}>
          <SeasonSegmentFilter activeSegment={activeSegment} basePath="/standings" />
        </Suspense>
      )}

      <DataTable
        rows={rows}
        columns={[
          { key: "rank", label: "순위", render: (row) => row.rank },
          {
            key: "team",
            label: "팀명",
            render: (row) => (
              <Link href={`/teams/${row.team.slug}`} className="font-semibold hover:text-accent">
                {row.team.name}
              </Link>
            ),
          },
          { key: "shortName", label: "약칭", render: (row) => row.team.shortName },
          { key: "match", label: "매치 전적", render: (row) => row.matchRecord },
          { key: "rate", label: "승률", render: (row) => row.winRate },
          { key: "diff", label: "세트 득실", render: (row) => row.setDiff },
          { key: "kda", label: "KDA", render: (row) => row.kda },
          { key: "kills", label: "킬", render: (row) => row.kills },
          { key: "deaths", label: "데스", render: (row) => row.deaths },
          { key: "assists", label: "어시스트", render: (row) => row.assists },
          {
            key: "next",
            label: "다음 경기",
            render: (row) =>
              row.nextMatch
                ? `${formatDateTime(row.nextMatch.matchDate)} · ${teamLabel(teams, row.nextMatch.teamAId)} vs ${teamLabel(teams, row.nextMatch.teamBId)}`
                : "-",
          },
        ]}
      />
    </main>
  );
}
