import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import {
  getCommunityPosts,
  getFanRatings,
  getMatches,
  getPlayers,
  getSets,
  getTeamBySlug,
  getTeams,
} from "@/lib/data/lck";
import {
  buildTeamStandingRows,
  buildTeamStatSummary,
  durationLabel,
  formatDateTime,
  matchSetScore,
  playerLabel,
  teamLabel,
  topFanRatingForMatch,
} from "@/lib/view-data";

const positions = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);

  if (!team) {
    notFound();
  }

  const [teams, players, matches, sets, fanRatings, communityPosts] = await Promise.all([
    getTeams(),
    getPlayers(),
    getMatches(),
    getSets(),
    getFanRatings(),
    getCommunityPosts(),
  ]);
  const standings = buildTeamStandingRows(teams, matches, sets);
  const standing = standings.find((row) => row.team.id === team.id);
  const stats = buildTeamStatSummary(team.id, sets);
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const teamMatches = matches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );
  const rosterRows = positions.map((position) => ({
    position,
    player: teamPlayers.find((player) => player.position === position),
  }));
  const relatedRatings = fanRatings.filter((rating) => rating.teamId === team.id);
  const avgFanRating =
    relatedRatings.length === 0
      ? "-"
      : (
          relatedRatings.reduce((sum, rating) => sum + rating.rating, 0) /
          relatedRatings.length
        ).toFixed(1);
  const recentReviews = communityPosts.filter(
    (post) => post.siteScope === "team" && post.teamId === team.id,
  );
  const nextMatch = standing?.nextMatch;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="팀 상세" title={team.name} />

      <section className="page-grid" aria-label="팀 요약">
        <StatCard label="약칭" value={team.shortName} />
        <StatCard label="현재 순위" value={standing ? `${standing.rank}위` : "-"} />
        <StatCard label="매치 전적" value={standing?.matchRecord ?? "-"} />
        <StatCard label="세트 전적" value={standing?.setRecord ?? "-"} />
        <StatCard label="승률" value={standing?.winRate ?? "-"} />
        <StatCard
          label="다음 경기"
          value={
            nextMatch
              ? `${formatDateTime(nextMatch.matchDate)} · ${teamLabel(teams, nextMatch.teamAId)} vs ${teamLabel(teams, nextMatch.teamBId)}`
              : "-"
          }
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-roster">
        <h2 id="team-roster" className="text-xl font-semibold">
          로스터
        </h2>
        <DataTable
          rows={rosterRows}
          columns={[
            { key: "position", label: "포지션", render: (row) => row.position },
            {
              key: "player",
              label: "선수",
              render: (row) =>
                row.player ? <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link> : "-",
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-stats">
        <h2 id="team-stats" className="text-xl font-semibold">
          팀 스탯 요약
        </h2>
        <div className="page-grid">
          <StatCard label="평균 킬" value={stats.avgKills.toFixed(1)} />
          <StatCard label="평균 데스" value={stats.avgDeaths.toFixed(1)} />
          <StatCard label="평균 골드" value={stats.avgGold.toLocaleString("ko-KR")} />
          <StatCard label="평균 타워" value={stats.avgTowers} />
          <StatCard label="팬 평점 평균" value={avgFanRating} />
          <StatCard label="최근 리뷰" value={recentReviews.length} />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="team-recent-matches">
        <h2 id="team-recent-matches" className="text-xl font-semibold">
          최근 경기
        </h2>
        <DataTable
          rows={teamMatches}
          columns={[
            { key: "date", label: "일시", render: (row) => formatDateTime(row.matchDate) },
            { key: "match", label: "경기", render: (row) => <Link href={`/matches/${row.id}`}>{row.name}</Link> },
            {
              key: "score",
              label: "스코어",
              render: (row) => `${row.teamAScore ?? "-"}:${row.teamBScore ?? "-"}`,
            },
            { key: "sets", label: "세트", render: (row) => matchSetScore(row, sets, teams) },
            { key: "duration", label: "최근 세트 시간", render: (row) => durationLabel(sets.find((set) => set.matchId === row.id)?.durationSeconds) },
            { key: "pom", label: "공식 POM", render: (row) => playerLabel(players, row.officialPomPlayerId) },
            { key: "rating", label: "팬 평점 1위", render: (row) => topFanRatingForMatch(row.id, fanRatings, players) },
          ]}
        />
      </section>

      <section className="flex flex-wrap gap-2" aria-label="팀 이동">
        <Link
          href={`/fan/${team.slug}`}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"
        >
          팬 사이트
        </Link>
        <Link
          href="/stats/teams"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          팀 스탯
        </Link>
      </section>
    </main>
  );
}
