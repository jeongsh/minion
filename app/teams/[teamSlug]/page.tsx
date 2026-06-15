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
  getTeamAwards,
  getTeamBySlug,
  getTeams,
  getTournaments,
} from "@/lib/data/lck";
import type { TeamAward } from "@/lib/types";
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

// 팀 수상만 표시 (개인 수상은 선수 상세 페이지에서 보여줌)
const TEAM_AWARD_TYPES = new Set([
  "lck_champion", "lck_runner_up",
  "worlds_champion", "worlds_runner_up",
  "msi_champion", "msi_runner_up",
  "first_stand_champion", "first_stand_runner_up",
  "ewc_champion", "ewc_runner_up",
]);

const AWARD_META: Record<string, { label: string; icon: string; style: string }> = {
  lck_champion:          { label: "LCK 우승",          icon: "🏆", style: "bg-yellow-500 text-white border-yellow-600" },
  lck_runner_up:         { label: "LCK 준우승",        icon: "🥈", style: "bg-zinc-500 text-white border-zinc-600" },
  worlds_champion:       { label: "Worlds 우승",       icon: "🏆", style: "bg-amber-500 text-white border-amber-600" },
  worlds_runner_up:      { label: "Worlds 준우승",     icon: "🥈", style: "bg-zinc-500 text-white border-zinc-600" },
  msi_champion:          { label: "MSI 우승",          icon: "🏆", style: "bg-sky-500 text-white border-sky-600" },
  msi_runner_up:         { label: "MSI 준우승",        icon: "🥈", style: "bg-zinc-500 text-white border-zinc-600" },
  first_stand_champion:  { label: "First Stand 우승",  icon: "🏆", style: "bg-violet-500 text-white border-violet-600" },
  first_stand_runner_up: { label: "First Stand 준우승", icon: "🥈", style: "bg-zinc-500 text-white border-zinc-600" },
  ewc_champion:          { label: "EWC 우승",          icon: "🏆", style: "bg-rose-500 text-white border-rose-600" },
  ewc_runner_up:         { label: "EWC 준우승",        icon: "🥈", style: "bg-zinc-500 text-white border-zinc-600" },
};

/** tournamentName에서 시즌(Spring/Summer/Season/Cup 등)을 추출해 라벨에 붙인다. */
function buildAwardLabel(award: TeamAward, baseLabel: string): string {
  // LCK 계열만 시즌 구분이 필요
  if (!award.awardType.startsWith("lck_")) return baseLabel;
  const m = award.tournamentName.match(/\b(Spring|Summer|Winter|Season|Cup)\b/i);
  if (!m) return baseLabel;
  const suffix = award.awardType === "lck_champion" ? "우승" : "준우승";
  return `LCK ${m[1]} ${suffix}`;
}

function AwardHistory({ awards }: { awards: TeamAward[] }) {
  const teamAwards = awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType));

  const byYear = new Map<number, TeamAward[]>();
  for (const a of teamAwards) {
    const arr = byYear.get(a.year) ?? [];
    arr.push(a);
    byYear.set(a.year, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {years.map((year, i) => {
        const yearAwards = byYear.get(year) ?? [];
        return (
          <div
            key={year}
            className={`flex items-center gap-4 px-5 py-3.5 ${i !== 0 ? "border-t border-border" : ""}`}
          >
            <span className="w-10 shrink-0 text-sm font-bold tabular-nums text-foreground">
              {year}
            </span>
            <div className="flex flex-wrap gap-2">
              {yearAwards.map((award) => {
                const meta = AWARD_META[award.awardType];
                const label = buildAwardLabel(award, meta?.label ?? award.awardType);
                return (
                  <span
                    key={award.id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${meta?.style ?? "bg-surface border-border text-foreground"}`}
                  >
                    <span>{meta?.icon}</span>
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

  const [teams, players, matches, sets, fanRatings, communityPosts, awards, tournaments] = await Promise.all([
    getTeams(),
    getPlayers(),
    getMatches(),
    getSets(),
    getFanRatings(),
    getCommunityPosts(),
    getTeamAwards(team.id),
    getTournaments(),
  ]);

  const latestSeason = Math.max(...tournaments.map((t) => t.season));
  const currentSeasonIds = new Set(
    tournaments.filter((t) => t.season === latestSeason).map((t) => t.id),
  );
  const currentSeasonMatches = matches.filter((m) => currentSeasonIds.has(m.tournamentId));

  const standings = buildTeamStandingRows(teams, currentSeasonMatches, sets);
  const standing = standings.find((row) => row.team.id === team.id);
  const stats = buildTeamStatSummary(team.id, sets);
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const teamMatches = currentSeasonMatches.filter(
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

      {awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType)).length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="team-awards">
          <h2 id="team-awards" className="text-xl font-semibold">수상 내역</h2>
          <AwardHistory awards={awards} />
        </section>
      )}

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
