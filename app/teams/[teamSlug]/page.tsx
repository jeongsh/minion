import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { TeamMatchHistory } from "@/components/domain/team-match-history";
import {
  getCommunityPosts,
  getFanRatings,
  getAllTeams,
  getLeagueAverageStats,
  getMatches,
  getPlayerStatLinesByTeam,
  getPlayers,
  getSets,
  getTeamAwards,
  getTeamBySlug,
  getTeams,
  getTournaments,
} from "@/lib/data/lck";
import type { TeamAward } from "@/lib/types";
import {
  buildLeagueRadarStats,
  buildTeamStandingRows,
  buildTeamStatSummary,
  durationLabel,
  formatDateTime,
  matchHref,
  playerLabel,
  teamLabel,
  topFanRatingForMatch,
  type LeagueAverageInput,
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

function TeamRadarChart({
  stats,
  leagueAvg,
  leagueAvgRaw,
}: {
  stats: ReturnType<typeof buildTeamStatSummary>;
  leagueAvg: ReturnType<typeof buildLeagueRadarStats>;
  leagueAvgRaw: LeagueAverageInput;
}) {
  const axes = [
    { label: "KDA",     score: stats.radarKda,       raw: stats.kda,       avgScore: leagueAvg.radarKda,       avgRaw: Number(leagueAvgRaw.avgKda).toFixed(2) },
    { label: "승률",    score: stats.radarWinRate,   raw: `${stats.winRate}%`, avgScore: leagueAvg.radarWinRate,   avgRaw: "50%" },
    { label: "골드차이", score: stats.radarGoldDiff,  raw: (stats.avgGoldDiff >= 0 ? "+" : "") + stats.avgGoldDiff.toLocaleString(), avgScore: leagueAvg.radarGoldDiff,  avgRaw: (leagueAvgRaw.avgGoldDiff >= 0 ? "+" : "") + Math.round(leagueAvgRaw.avgGoldDiff).toLocaleString() },
    { label: "딜량",    score: stats.radarDamage,    raw: (stats.avgDmg / 1000).toFixed(0) + "k", avgScore: leagueAvg.radarDamage,    avgRaw: (leagueAvgRaw.avgDmg / 1000).toFixed(0) + "k" },
    { label: "오브젝트", score: stats.radarObjective, raw: "",              avgScore: leagueAvg.radarObjective, avgRaw: leagueAvgRaw.avgObjectives.toFixed(1) + "/게임" },
  ];
  const center = 130;
  const maxRadius = 76;
  const toPoints = (values: number[]) =>
    values.map((value, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
      const r = (value / 100) * maxRadius;
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" ");
  const teamPoints = toPoints(axes.map((a) => a.score));
  const avgPoints = toPoints(axes.map((a) => a.avgScore));
  const grid = [0.25, 0.5, 0.75, 1].map((scale) =>
    axes.map((_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
      const r = maxRadius * scale;
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" "),
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-center">
      <svg viewBox="0 0 260 260" className="mx-auto w-full max-w-xs">
        {grid.map((polygon, gi) => (
          <polygon key={gi} points={polygon} className="fill-surface-muted stroke-border" strokeWidth="0.5" />
        ))}
        {axes.map((_, i) => {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
          return (
            <line key={i} x1={center} y1={center}
              x2={center + Math.cos(angle) * maxRadius}
              y2={center + Math.sin(angle) * maxRadius}
              className="stroke-border" strokeWidth="0.5" />
          );
        })}
        <polygon points={avgPoints} fill="rgba(156,163,175,0.15)" stroke="rgb(156,163,175)" strokeWidth="1.5" strokeDasharray="4 2" />
        <polygon points={teamPoints} className="fill-accent/20 stroke-accent" strokeWidth="2" />
        {axes.map((axis, i) => {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / axes.length;
          const x = center + Math.cos(angle) * (maxRadius + 24);
          const y = center + Math.sin(angle) * (maxRadius + 18);
          return (
            <text key={axis.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[10px] font-semibold">
              <tspan x={x} dy="-6">{axis.label}</tspan>
              <tspan x={x} dy="13" className="fill-accent text-[9px]">{Math.round(axis.score)}</tspan>
            </text>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <div className="col-span-2 flex items-center gap-3 text-xs text-muted md:col-span-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            팀
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="4"><line x1="0" y1="2" x2="12" y2="2" stroke="rgb(156,163,175)" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
            리그 평균
          </span>
        </div>
        {axes.map((axis) => (
          <div key={axis.label} className="rounded-md border border-border bg-background/45 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">{axis.label}</span>
              <strong>
                {Math.round(axis.score)}
                {axis.raw && <span className="font-normal text-muted"> ({axis.raw})</span>}
              </strong>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
              <span>리그 평균</span>
              <span>{Math.round(axis.avgScore)}{axis.avgRaw && ` (${axis.avgRaw})`}</span>
            </div>
          </div>
        ))}
      </div>
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

  const [teams, allTeams, players, matches, sets, fanRatings, communityPosts, awards, tournaments, playerStats, leagueAvgInput] = await Promise.all([
    getTeams(),
    getAllTeams(),
    getPlayers(),
    getMatches(),
    getSets(),
    getFanRatings(),
    getCommunityPosts(),
    getTeamAwards(team.id),
    getTournaments(),
    getPlayerStatLinesByTeam(team.id),
    getLeagueAverageStats(),
  ]);

  const latestSeason = Math.max(...tournaments.map((t) => t.season));
  const currentSeasonIds = new Set(
    tournaments.filter((t) => t.season === latestSeason).map((t) => t.id),
  );
  const currentSeasonMatches = matches.filter((m) => currentSeasonIds.has(m.tournamentId));

  const standings = buildTeamStandingRows(teams, currentSeasonMatches, sets);
  const standing = standings.find((row) => row.team.id === team.id);
  const stats = buildTeamStatSummary(team.id, sets, playerStats);
  const leagueAvg = buildLeagueRadarStats(leagueAvgInput);
  const teamPlayers = players.filter((player) => player.teamId === team.id);
  const starters = [...teamPlayers]
    .filter((p) => p.isStarter)
    .sort((a, b) => POS_ORDER.indexOf(a.position as typeof POS_ORDER[number]) - POS_ORDER.indexOf(b.position as typeof POS_ORDER[number]));
  const teamMatches = currentSeasonMatches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );

  const allTeamMatches = matches.filter(
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
      <div className="text-sm text-muted">
        <Link href="/teams" className="hover:text-foreground">팀</Link>
        <span className="mx-2">›</span>
        <span>팀 상세</span>
      </div>
      <div className="flex items-center gap-6">
        {team.logoUrl && (
          <img src={team.logoUrl} alt={team.name} className="h-28 w-28 object-contain md:h-36 md:w-36" />
        )}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">{team.name}</h1>
            {team.globalPowerRank != null && (
              <a
                href="https://lolesports.com/ko-KR/gpr/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border bg-surface px-3 py-1 text-sm font-bold text-black hover:bg-surface-muted"
              >
                글로벌 {team.globalPowerRank}위
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 팬 사이트 */}
            <Link
              href={`/fan/${team.slug}`}
              title="팬 사이트"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-accent bg-accent text-accent-foreground hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </Link>
            {/* 공식 홈페이지 */}
            {team.officialHomepageUrl && (
              <a
                href={team.officialHomepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="공식 홈페이지"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-muted"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-muted" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.9 6h-2.8a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4.1c.8 1.1 1.5 2.5 1.9 3.9h-3.8c.4-1.4 1.1-2.8 1.9-3.9zM4.3 14a8.2 8.2 0 0 1 0-4h3.1a16.7 16.7 0 0 0 0 4zm.8 2h2.8a15.6 15.6 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16zm2.8-8H5.1A8 8 0 0 1 9.3 4.4 15.6 15.6 0 0 0 7.9 8zM12 19.9c-.8-1.1-1.5-2.5-1.9-3.9h3.8c-.4 1.4-1.1 2.8-1.9 3.9zM14.3 14H9.7a14.8 14.8 0 0 1 0-4h4.6a14.8 14.8 0 0 1 0 4zm.4 5.6a15.6 15.6 0 0 0 1.4-3.6h2.8a8 8 0 0 1-4.2 3.6zM16.6 14a16.7 16.7 0 0 0 0-4h3.1a8.2 8.2 0 0 1 0 4z" />
                </svg>
              </a>
            )}
            {/* 유튜브 */}
            {team.officialYoutubeUrl && (
              <a
                href={team.officialYoutubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="유튜브"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-muted"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-red-500" aria-hidden="true">
                  <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.6 12 4.6 12 4.6s-5.8 0-7.6.6a2.8 2.8 0 0 0-2 2A29.4 29.4 0 0 0 2 12a29.4 29.4 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.6 7.6.6 7.6.6s5.8 0 7.6-.6a2.8 2.8 0 0 0 2-2 29.4 29.4 0 0 0 .4-4.8 29.4 29.4 0 0 0-.4-4.8zM10 15.5v-7l6 3.5z" />
                </svg>
              </a>
            )}
            {/* X */}
            {team.officialXUrl && (
              <a
                href={team.officialXUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="X (Twitter)"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-muted"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
            {/* 인스타그램 */}
            {team.officialInstagramUrl && (
              <a
                href={team.officialInstagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="인스타그램"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface hover:bg-surface-muted"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-pink-500" aria-hidden="true">
                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zM18 6.3a1.2 1.2 0 1 1-1.2 1.2 1.2 1.2 0 0 1 1.2-1.2z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-8" aria-labelledby="team-roster">
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
                    className="text-xs font-bold tracking-wider text-black"
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
                  {player.contractExpiry && (
                    <p className="mt-1.5 text-xs text-muted">
                      계약 <span className="font-semibold text-foreground">{player.contractExpiry.slice(0, 7)}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {starters.length === 0 && (
          <p className="text-sm text-muted">등록된 선수가 없습니다.</p>
        )}

        {/* 코칭 스태프 + 팀 스탯 */}
        <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
          {(team.headCoach || team.coaches) && (() => {
            const teamAwards = awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType));
            const countByType = new Map<string, number>();
            for (const a of teamAwards) countByType.set(a.awardType, (countByType.get(a.awardType) ?? 0) + 1);
            const summaryItems = SUMMARY_ORDER.filter((s) => (countByType.get(s.type) ?? 0) > 0);
            return (
              <div
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-5"
                style={{ borderLeftColor: team.primaryColor, borderLeftWidth: 4 }}
              >
                <p className="text-xl font-bold">팀 정보</p>

                {/* 코칭 스태프 */}
                <div className="flex flex-col gap-2">
                  <p className="text-base font-bold text-muted">코칭 스태프</p>
                  {team.headCoach && (
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-sm text-muted">감독</span>
                      <span className="text-lg font-semibold">{team.headCoach}</span>
                    </div>
                  )}
                  {team.coaches && team.coaches.split(",").map((c) => c.trim()).filter(Boolean).map((coach) => (
                    <div key={coach} className="flex items-center gap-3">
                      <span className="w-8 text-sm text-muted">코치</span>
                      <span className="text-lg font-semibold">{coach}</span>
                    </div>
                  ))}
                </div>

                {/* 우승 이력 */}
                {(() => {
                  const LEAGUE_ROWS = [
                    { label: "LCK",         champion: "lck_champion",         runnerUp: "lck_runner_up" },
                    { label: "Worlds",       champion: "worlds_champion",       runnerUp: "worlds_runner_up" },
                    { label: "MSI",          champion: "msi_champion",          runnerUp: "msi_runner_up" },
                    { label: "First Stand",  champion: "first_stand_champion",  runnerUp: "first_stand_runner_up" },
                    { label: "EWC",          champion: "ewc_champion",          runnerUp: "ewc_runner_up" },
                  ];
                  const rows = LEAGUE_ROWS.filter((r) =>
                    (countByType.get(r.champion) ?? 0) > 0 || (countByType.get(r.runnerUp) ?? 0) > 0
                  );
                  if (rows.length === 0) return null;
                  return (
                    <div className="flex flex-col gap-2 border-t border-border pt-4">
                      <p className="text-base font-bold text-muted">우승 이력</p>
                      <div className="flex flex-col gap-2">
                        {rows.map((r) => {
                          const champ = countByType.get(r.champion) ?? 0;
                          const runner = countByType.get(r.runnerUp) ?? 0;
                          return (
                            <div key={r.label} className="flex items-center gap-3 text-base">
                              <span className="w-24 font-semibold">{r.label}</span>
                              <span className="text-muted">:</span>
                              {champ > 0 && <span>우승 <strong>{champ}회</strong></span>}
                              {runner > 0 && <span className="text-muted">준우승 {runner}회</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {stats.setCount > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xl font-bold">팀 스탯</p>
                <p className="text-xs text-muted">{stats.setCount}세트 기준</p>
              </div>
              <TeamRadarChart stats={stats} leagueAvg={leagueAvg} leagueAvgRaw={leagueAvgInput} />
            </div>
          )}
        </div>
      </section>

      {awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType)).length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="team-awards">
          <h2 id="team-awards" className="text-xl font-semibold">수상 내역</h2>
          <AwardHistory awards={awards} />
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="team-recent-matches">
        <h2 id="team-recent-matches" className="text-xl font-semibold">최근 경기</h2>

        {/* 간략 요약 */}
        <div className="flex flex-wrap gap-2">
          {[...teamMatches].reverse().slice(0, 5).map((row) => {
            const opponentId = row.teamAId === team.id ? row.teamBId : row.teamAId;
            const opponent = allTeams.find((t) => t.id === opponentId);
            const myScore = row.teamAId === team.id ? row.teamAScore : row.teamBScore;
            const opScore = row.teamAId === team.id ? row.teamBScore : row.teamAScore;
            if (myScore == null || opScore == null) return null;
            const win = myScore > opScore;
            return (
              <Link
                key={row.id}
                href={matchHref(row)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:bg-surface-muted"
              >
                <span className="text-muted">{opponent?.shortName ?? "?"}</span>
                <span className={`font-bold ${win ? "text-blue-600" : "text-red-500"}`}>
                  {win ? "승" : "패"}
                </span>
                <span className="text-muted">{myScore}:{opScore}</span>
              </Link>
            );
          })}
        </div>

        <TeamMatchHistory
          teamId={team.id}
          matches={allTeamMatches}
          sets={sets}
          teams={allTeams}
          players={players}
          tournaments={tournaments}
        />
      </section>


    </main>
  );
}
