import Link from "next/link";
import { Suspense } from "react";

import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayers, getTeamStandings, getTeams, getTournaments } from "@/lib/data/lck";
import { buildTeamStandingRows, formatDateTime, teamLabel } from "@/lib/view-data";
import { StandingsFilter } from "./standings-filter";

function parseView(raw: string | undefined): "teams" | "players" {
  return raw === "players" ? "players" : "teams";
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; view?: string }>;
}) {
  const params = await searchParams;
  const activeView = parseView(params.view);

  const [teams, matches, tournaments, savedStandings, players] = await Promise.all([
    getTeams(),
    getMatches(),
    getTournaments(),
    getTeamStandings(),
    getPlayers(),
  ]);

  // 사용 가능한 시즌 목록 (내림차순)
  const seasons = [...new Set(tournaments.map((t) => t.season))].sort((a, b) => b - a);
  const latestSeason = seasons[0] ?? 2026;
  const activeSeason = params.season ? Number(params.season) : latestSeason;

  // 해당 시즌의 토너먼트 ID 집합
  const seasonTournamentIds = new Set(
    tournaments.filter((t) => t.season === activeSeason).map((t) => t.id),
  );

  // 해당 시즌 경기만 필터
  const seasonMatches = matches.filter((m) => seasonTournamentIds.has(m.tournamentId));

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // ── 팀 순위 ──────────────────────────────────────────────
  const savedForSeason = savedStandings.filter((s) => seasonTournamentIds.has(s.tournamentId));
  const useStoredStandings = savedForSeason.length > 0;

  const teamRows = useStoredStandings
    ? savedForSeason
        .map((s) => {
          const team = teamMap.get(s.teamId);
          if (!team) return null;
          const teamMatches = seasonMatches.filter(
            (m) => m.teamAId === team.id || m.teamBId === team.id,
          );
          const nextMatch = teamMatches
            .filter((m) => m.status !== "completed")
            .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())[0];
          const recent =
            teamMatches
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
    : buildTeamStandingRows(teams, seasonMatches, []).map((r) => ({
        ...r,
        setDiff: "-",
        kda: "-",
        kills: "-",
        deaths: "-",
        assists: "-",
      }));

  // ── 선수 POM 랭킹 ─────────────────────────────────────────
  const pomCounts = new Map<string, number>();
  for (const match of seasonMatches) {
    if (match.officialPomPlayerId) {
      pomCounts.set(
        match.officialPomPlayerId,
        (pomCounts.get(match.officialPomPlayerId) ?? 0) + 1,
      );
    }
  }
  const playerRows = [...pomCounts.entries()]
    .map(([playerId, count]) => ({ player: playerMap.get(playerId), count }))
    .filter((r) => r.player != null)
    .sort((a, b) => b.count - a.count)
    .map((r, i) => ({ rank: i + 1, player: r.player!, team: teamMap.get(r.player!.teamId), count: r.count }));

  const title = activeView === "players"
    ? `${activeSeason} 선수 POM 랭킹`
    : `${activeSeason} 팀 순위표`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="순위" title={title} />

      <Suspense fallback={null}>
        <StandingsFilter
          seasons={seasons}
          activeSeason={activeSeason}
          activeView={activeView}
        />
      </Suspense>

      {activeView === "teams" ? (
        <DataTable
          rows={teamRows}
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
      ) : (
        <DataTable
          rows={playerRows}
          columns={[
            { key: "rank", label: "순위", render: (row) => row.rank },
            {
              key: "player",
              label: "선수",
              render: (row) => (
                <Link href={`/players/${row.player.slug}`} className="font-semibold hover:text-accent">
                  {row.player.name}
                </Link>
              ),
            },
            {
              key: "team",
              label: "팀",
              render: (row) =>
                row.team ? (
                  <Link href={`/teams/${row.team.slug}`} className="hover:text-accent">
                    {row.team.shortName}
                  </Link>
                ) : "-",
            },
            { key: "position", label: "포지션", render: (row) => row.player.position },
            {
              key: "pom",
              label: "POM 횟수",
              render: (row) => (
                <span className="font-bold tabular-nums text-accent">{row.count}</span>
              ),
            },
          ]}
        />
      )}
    </main>
  );
}
