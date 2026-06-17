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
  matchHref,
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
  lck_champion:          { label: "LCK 우승",          icon: "🏆", style: "bg-yellow-400/30 text-black border-yellow-500/40" },
  lck_runner_up:         { label: "LCK 준우승",        icon: "🥈", style: "bg-zinc-200/60 text-black border-zinc-400/40" },
  worlds_champion:       { label: "Worlds 우승",       icon: "🏆", style: "bg-amber-400/30 text-black border-amber-500/40" },
  worlds_runner_up:      { label: "Worlds 준우승",     icon: "🥈", style: "bg-zinc-200/60 text-black border-zinc-400/40" },
  msi_champion:          { label: "MSI 우승",          icon: "🏆", style: "bg-sky-400/30 text-black border-sky-500/40" },
  msi_runner_up:         { label: "MSI 준우승",        icon: "🥈", style: "bg-zinc-200/60 text-black border-zinc-400/40" },
  first_stand_champion:  { label: "First Stand 우승",  icon: "🏆", style: "bg-violet-400/30 text-black border-violet-500/40" },
  first_stand_runner_up: { label: "First Stand 준우승", icon: "🥈", style: "bg-zinc-200/60 text-black border-zinc-400/40" },
  ewc_champion:          { label: "EWC 우승",          icon: "🏆", style: "bg-rose-400/30 text-black border-rose-500/40" },
  ewc_runner_up:         { label: "EWC 준우승",        icon: "🥈", style: "bg-zinc-200/60 text-black border-zinc-400/40" },
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

const SUMMARY_ORDER = [
  { type: "lck_champion",          label: "LCK 우승",           icon: "🏆", champion: true },
  { type: "worlds_champion",       label: "Worlds 우승",         icon: "🌍", champion: true },
  { type: "msi_champion",          label: "MSI 우승",            icon: "🏆", champion: true },
  { type: "first_stand_champion",  label: "First Stand 우승",    icon: "🏆", champion: true },
  { type: "ewc_champion",          label: "EWC 우승",            icon: "🏆", champion: true },
];

function AwardHistory({ awards }: { awards: TeamAward[] }) {
  const teamAwards = awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType));

  // 요약: 종류별 횟수 집계
  const countByType = new Map<string, number>();
  for (const a of teamAwards) {
    countByType.set(a.awardType, (countByType.get(a.awardType) ?? 0) + 1);
  }
  const summaryItems = SUMMARY_ORDER.filter((s) => (countByType.get(s.type) ?? 0) > 0);

  // 전체 이력: 연도별 그룹
  const byYear = new Map<number, TeamAward[]>();
  for (const a of teamAwards) {
    const arr = byYear.get(a.year) ?? [];
    arr.push(a);
    byYear.set(a.year, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-3">
      {/* 요약 배지 */}
      <div className="flex flex-wrap gap-3">
        {summaryItems.map((s) => {
          const count = countByType.get(s.type) ?? 0;
          return (
            <span
              key={s.type}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-base font-semibold text-black"
            >
              {s.label} <span className="text-lg font-bold">{count}회</span>
            </span>
          );
        })}
      </div>

      {/* 전체 이력 토글 */}
      <details className="group overflow-hidden rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-surface-muted">
          <span>전체 수상 이력</span>
          <span className="text-muted transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-border">
          {years.map((year, i) => {
            const yearAwards = byYear.get(year) ?? [];
            return (
              <div
                key={year}
                className={`flex items-center gap-4 px-4 py-3 ${i !== 0 ? "border-t border-border" : ""}`}
              >
                <span className="w-10 shrink-0 text-sm font-bold tabular-nums">
                  {year}
                </span>
                <div className="flex flex-wrap gap-2">
                  {yearAwards.map((award) => {
                    const meta = AWARD_META[award.awardType];
                    const label = buildAwardLabel(award, meta?.label ?? award.awardType);
                    return (
                      <span
                        key={award.id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta?.style ?? "bg-surface border-border text-foreground"}`}
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
      </details>
    </div>
  );
}

const POS_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;
const POS_LABEL: Record<string, string> = {
  TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서폿",
};

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
  const starters = [...teamPlayers]
    .filter((p) => p.isStarter)
    .sort((a, b) => POS_ORDER.indexOf(a.position as typeof POS_ORDER[number]) - POS_ORDER.indexOf(b.position as typeof POS_ORDER[number]));
  const teamMatches = currentSeasonMatches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );
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
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-accent">팀 상세</p>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">{team.name}</h1>
          {team.globalPowerRank != null && (
            <a
              href="https://lolesports.com/ko-KR/gpr/"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-lg font-bold text-black hover:bg-surface-muted"
            >
              글로벌 {team.globalPowerRank}위
            </a>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-8" aria-labelledby="team-roster">
        <h2 id="team-roster" className="text-xl font-semibold">로스터</h2>

        {/* 주전 선수 */}
        {starters.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {starters.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-transform duration-150 hover:scale-[1.02] hover:shadow-lg"
              >
                {/* 포지션 라벨 */}
                <div className="px-3 pt-2.5">
                  <span
                    className="text-xs font-bold tracking-wider"
                    style={{ color: team.primaryColor }}
                  >
                    {player.position}
                  </span>
                </div>

                {/* 포트레이트 이미지 */}
                <div className="mx-3 mb-0 mt-1.5 overflow-hidden rounded-lg border border-border bg-surface-muted" style={{ aspectRatio: "3/4" }}>
                  {player.profileImageUrl ? (
                    <img
                      src={player.profileImageUrl}
                      alt={player.name}
                      className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-4xl font-bold"
                      style={{ backgroundColor: team.primaryColor + "22", color: team.primaryColor }}
                    >
                      {player.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* 이름 */}
                <div className="px-3 py-3">
                  <p className="font-bold leading-tight group-hover:text-accent">{player.name}</p>
                  {player.realName && (
                    <p className="mt-0.5 text-xs text-muted">{player.realName}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {starters.length === 0 && (
          <p className="text-sm text-muted">등록된 선수가 없습니다.</p>
        )}

        {/* 코칭 스태프 */}
        {(team.headCoach || team.coaches) && (
          <div
            className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-surface px-6 py-4"
            style={{ borderLeftColor: team.primaryColor, borderLeftWidth: 4 }}
          >
            <p className="text-sm font-bold text-muted">코칭 스태프</p>
            {team.headCoach && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">감독</span>
                <span className="font-semibold">{team.headCoach}</span>
              </div>
            )}
            {team.coaches && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">코치</span>
                <span className="font-semibold">{team.coaches}</span>
              </div>
            )}
          </div>
        )}
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
            { key: "match", label: "경기", render: (row) => <Link href={matchHref(row)}>{row.name}</Link> },
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
