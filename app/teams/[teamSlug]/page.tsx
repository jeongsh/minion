import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, ExternalLink, Globe2, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AdSlot } from "@/components/ui/ad-slot";
import { TeamMatchHistory } from "@/components/domain/team-match-history";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import {
  getFanRatingsByTeamId,
  getAllTeams,
  getMatches,
  getPlayerStatLinesByTeam,
  getPlayers,
  getSets,
  getTeamAwards,
  getTeamBySlug,
  getTeams,
  getTournaments,
} from "@/lib/data/lck";
import { getLeagueAverageStats } from "@/lib/data/player-cache";
import { getBoardPosts } from "@/lib/data/community";
import type { TeamAward } from "@/lib/types";
import {
  buildLeagueRadarStats,
  buildTeamStandingRows,
  buildTeamStatSummary,
  formatDateTime,
  matchHref,
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

function AwardHistory({ awards }: { awards: TeamAward[] }) {
  const teamAwards = awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType));

  // 요약: 종류별 횟수 집계
  const countByType = new Map<string, number>();
  for (const a of teamAwards) {
    countByType.set(a.awardType, (countByType.get(a.awardType) ?? 0) + 1);
  }
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
      <details className="group overflow-hidden rounded-2xl border border-[var(--ui-border)]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-[var(--ui-surface-muted)]">
          <span>전체 수상 이력</span>
          <span className="text-[var(--ui-muted)] transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-[var(--ui-border)]">
          {years.map((year, i) => {
            const yearAwards = byYear.get(year) ?? [];
            return (
              <div
                key={year}
                className={`flex items-center gap-4 px-4 py-3 ${i !== 0 ? "border-t border-[var(--ui-border)]" : ""}`}
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
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${meta?.style ?? "bg-surface border-border text-foreground"}`}
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

function TeamSectionTitle({
  title,
  caption,
  aside,
}: {
  title: string;
  caption?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">{title}</h2>
      {aside ?? (caption ? <span className="pb-0.5 text-[13px] font-semibold text-[var(--ui-muted)]">{caption}</span> : null)}
    </div>
  );
}

function TeamMetricCard({ label, value, helper }: { label: string; value: React.ReactNode; helper?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
      <p className="text-[13px] font-semibold text-[var(--ui-muted)]">{label}</p>
      <p className="mt-2 text-[28px] font-black leading-none tracking-tight tabular-nums text-[var(--ui-ink)]">{value}</p>
      {helper ? <p className="mt-1.5 text-[13px] text-[var(--ui-muted)]">{helper}</p> : null}
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
            <text key={axis.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[13px] font-semibold">
              <tspan x={x} dy="-6">{axis.label}</tspan>
              <tspan x={x} dy="13" className="fill-accent text-[13px]">{Math.round(axis.score)}</tspan>
            </text>
          );
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <div className="col-span-2 flex items-center gap-3 text-[13px] text-muted md:col-span-1">
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
            <div className="mt-1 flex items-center justify-between gap-2 text-[13px] text-muted">
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

  const [teams, allTeams, players, matches, sets, fanRatings, teamPosts, awards, tournaments, playerStats, leagueAvgInput] = await Promise.all([
    getTeams(),
    getAllTeams(),
    getPlayers(),
    getMatches(),
    getSets(),
    getFanRatingsByTeamId(team.id),
    getBoardPosts({ scope: "team", teamId: team.id }),
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

  const avgFanRating =
    fanRatings.length === 0
      ? "-"
      : (
          fanRatings.reduce((sum, rating) => sum + rating.rating, 0) /
          fanRatings.length
        ).toFixed(1);
  const nextMatch = standing?.nextMatch;

  return (
    <main
      className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]"
      style={{ "--tp": team.primaryColor } as React.CSSProperties}
    >
      <div className="layout-wide flex flex-col gap-7 pb-16 pt-6 sm:pt-8 md:gap-12">
        <PageHeader title={team.name} breadcrumbs={[{ label: "팀", href: "/teams" }, { label: team.name }]} />

        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--ui-border)] px-5 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-[var(--ui-muted)]">시즌</span>
            <strong className="text-sm text-[var(--ui-ink)]">{latestSeason} LCK</strong>
          </div>
          <span className="hidden h-[22px] w-px bg-[var(--ui-border)] sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-[var(--ui-muted)]">순위</span>
            <strong className="text-base" style={{ color: "var(--tp)" }}>{standing ? `${standing.rank}위` : "-"}</strong>
          </div>
          <span className="hidden h-[22px] w-px bg-[var(--ui-border)] sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] text-[var(--ui-muted)]">최근 5경기</span>
            <strong className="text-sm font-bold tabular-nums text-[var(--ui-ink)]">{standing?.recent ?? "-"}</strong>
          </div>
          <Link href={`/fan/${team.fanSiteHost || team.slug}`} className="ml-auto rounded-full bg-[var(--ui-ink)] px-4 py-2 text-sm font-semibold text-[var(--ui-surface)] transition-opacity hover:opacity-90">
            팬 채널
          </Link>
        </div>

        <section className="grid gap-5 min-[1200px]:grid-cols-[330px_1fr] min-[1200px]:gap-10">
          <div
            className="relative h-40 w-full overflow-hidden rounded-2xl bg-[var(--ui-surface-muted)] sm:h-52 min-[1200px]:h-auto min-[1200px]:aspect-[4/5]"
            style={{
              backgroundColor: `color-mix(in oklab, var(--tp) 12%, var(--ui-surface-muted))`,
              backgroundImage: team.backgroundUrl ? `url("${team.backgroundUrl}")` : undefined,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(12,11,15,0.9)] via-[rgba(12,11,15,0.16)] to-transparent" />
            {team.logoUrl ? <img src={team.logoUrl} alt={team.name} className="absolute left-6 top-1/2 h-24 w-24 -translate-y-1/2 object-contain drop-shadow-xl sm:h-28 sm:w-28 min-[1200px]:left-1/2 min-[1200px]:top-[42%] min-[1200px]:h-36 min-[1200px]:w-36 min-[1200px]:-translate-x-1/2" /> : null}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-4 pt-20">
              <div className="min-w-0">
                <p className="text-[13px] font-black uppercase tracking-[0.1em] text-white/65">{team.shortName}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {team.officialHomepageUrl ? <a href={team.officialHomepageUrl} target="_blank" rel="noopener noreferrer" title="공식 홈페이지" className="grid h-8 w-8 place-items-center rounded-full bg-white/14 text-white backdrop-blur hover:bg-white/25"><Globe2 size={15} /></a> : null}
                {team.officialYoutubeUrl ? <a href={team.officialYoutubeUrl} target="_blank" rel="noopener noreferrer" title="유튜브" className="grid h-8 w-8 place-items-center rounded-full bg-white/14 text-white backdrop-blur hover:bg-white/25"><Play size={14} /></a> : null}
                {team.officialXUrl ? <a href={team.officialXUrl} target="_blank" rel="noopener noreferrer" title="X" className="grid h-8 w-8 place-items-center rounded-full bg-white/14 text-[13px] font-medium text-white backdrop-blur hover:bg-white/25">X</a> : null}
                {team.officialInstagramUrl ? <a href={team.officialInstagramUrl} target="_blank" rel="noopener noreferrer" title="인스타그램" className="grid h-8 w-8 place-items-center rounded-full bg-white/14 text-white backdrop-blur hover:bg-white/25"><AtSign size={14} /></a> : null}
              </div>
            </div>
          </div>

          <section aria-labelledby="team-stats-overview" className="hidden md:block">
            <TeamSectionTitle
              title="팀 지표"
              aside={team.globalPowerRank != null ? <a href="https://lolesports.com/ko-KR/gpr/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 pb-0.5 text-[13px] font-bold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">글로벌 {team.globalPowerRank}위 <ExternalLink size={13} /></a> : undefined}
            />
            {stats.setCount > 0 ? (
              <TeamRadarChart stats={stats} leagueAvg={leagueAvg} leagueAvgRaw={leagueAvgInput} />
            ) : (
              <KitschEmptyState character="marker" title="팀 지표 집계 중" body="세트 데이터가 쌓이면 레이더가 켜져요." compact />
            )}
          </section>
        </section>

        <section>
          <TeamSectionTitle title="시즌 요약" caption={`${latestSeason} LCK`} />
          <div className="grid grid-cols-2 gap-2 sm:gap-3 min-[1200px]:grid-cols-4">
            <TeamMetricCard label="시즌 전적" value={standing?.matchRecord ?? "-"} helper={`${standing?.matchWins ?? 0}W ${standing?.matchLosses ?? 0}L`} />
            <TeamMetricCard label="세트 전적" value={standing?.setRecord ?? "-"} helper={`세트 득실 ${standing && standing.setDiff > 0 ? "+" : ""}${standing?.setDiff ?? 0}`} />
            <TeamMetricCard label="승률" value={standing?.winRate ?? "-"} />
            <TeamMetricCard label="다음 경기" value={nextMatch ? "예정" : "-"} helper={nextMatch ? formatDateTime(nextMatch.matchDate) : "예정된 경기가 없습니다."} />
          </div>
        </section>

        <section className="hidden md:block">
          <TeamSectionTitle title="팬 평가" />
          <div className="grid gap-3 sm:grid-cols-2 min-[1200px]:grid-cols-4">
            <div className="rounded-2xl border border-[var(--ui-border)] p-4" style={{ background: "color-mix(in oklab, var(--tp) 6%, var(--ui-surface))" }}>
              <p className="text-[13px] font-semibold text-[var(--ui-muted)]">팀 팬 평점</p>
              <p className="mt-2 text-[28px] font-black leading-none tabular-nums text-[var(--ui-ink)]">{avgFanRating}<span className="ml-1 text-sm font-semibold text-[var(--ui-muted)]">/ 5</span></p>
            </div>
            <TeamMetricCard label="평가 수" value={fanRatings.length} />
            <TeamMetricCard label="팀 게시글" value={teamPosts.length} />
            <div className="flex flex-col justify-between rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
              <div><p className="text-[13px] font-semibold text-[var(--ui-muted)]">팬 채널</p><p className="mt-2 text-[15px] leading-6 text-[var(--ui-text)]">경기와 선수 소식을 팀 팬들과 함께 확인하세요.</p></div>
              <Link href={`/fan/${team.fanSiteHost || team.slug}`} className="mt-3 text-right text-[13px] font-bold" style={{ color: "var(--tp)" }}>팬 채널 보기 →</Link>
            </div>
          </div>
        </section>

      <AdSlot placement="horizontal" className="hidden h-[60px] md:block xl:h-[90px]" />

      <section className="flex flex-col gap-8" aria-labelledby="team-roster">
        {/* 주전 선수 */}
        {starters.length > 0 && (
          <div>
            <div className="mb-4 flex items-end justify-between border-b border-[var(--ui-border)] pb-3">
              <h2 id="team-roster" className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">주전 선수</h2>
              <span className="text-[13px] text-[var(--ui-muted)]">STARTING FIVE</span>
            </div>
            <div className="grid auto-cols-[132px] grid-flow-col gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:gap-3 sm:overflow-visible md:grid-cols-5 [&::-webkit-scrollbar]:hidden">
            {starters.map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] transition-colors hover:bg-[var(--ui-surface-muted)]"
              >
                {/* 포지션 라벨 */}
                <div className="px-3 pt-2.5">
                  <span
                    className="text-[13px] font-bold tracking-wider"
                    style={{ color: "var(--tp)" }}
                  >
                    {player.position}
                  </span>
                </div>

                {/* 포트레이트 이미지 */}
                <div className="mx-3 mb-0 mt-1.5 overflow-hidden rounded-xl bg-[var(--ui-surface-muted)]" style={{ aspectRatio: "3/4" }}>
                  {player.profileImageUrl ? (
                    <img
                      src={player.profileImageUrl}
                      alt={player.name}
                      className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-[28px] font-bold"
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
                    <p className="mt-0.5 text-[13px] text-[var(--ui-muted)]">{player.realName}</p>
                  )}
                  {player.contractExpiry && (
                    <p className="mt-1.5 text-[13px] text-[var(--ui-muted)]">
                      계약 <span className="font-semibold text-[var(--ui-ink)]">{player.contractExpiry.slice(0, 7)}</span>
                    </p>
                  )}
                </div>
              </Link>
            ))}
            </div>
          </div>
        )}

        {starters.length === 0 && (
          <KitschEmptyState character="marker" title="로스터 대기 중" body="등록된 선수가 생기면 주전 라인업을 바로 보여드릴게요." animated />
        )}

        {/* 코칭 스태프 */}
        <div>
          {(team.headCoach || team.coaches) && (() => {
            const teamAwards = awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType));
            const countByType = new Map<string, number>();
            for (const a of teamAwards) countByType.set(a.awardType, (countByType.get(a.awardType) ?? 0) + 1);
            return (
              <div
                className="flex flex-col gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-6 py-5"
              >
                <p className="home-section-title border-b border-[var(--ui-border)] pb-3 text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">팀 정보</p>

                {/* 코칭 스태프 */}
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-[var(--ui-muted)]">코칭 스태프</p>
                  {team.headCoach && (
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-sm text-[var(--ui-muted)]">감독</span>
                      <span className="text-base font-semibold">{team.headCoach}</span>
                    </div>
                  )}
                  {team.coaches && team.coaches.split(",").map((c) => c.trim()).filter(Boolean).map((coach) => (
                    <div key={coach} className="flex items-center gap-3">
                      <span className="w-8 text-sm text-[var(--ui-muted)]">코치</span>
                      <span className="text-base font-semibold">{coach}</span>
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
                    <div className="flex flex-col gap-2 border-t border-[var(--ui-border)] pt-4">
                      <p className="text-sm font-bold text-[var(--ui-muted)]">우승 이력</p>
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
        </div>
      </section>

      {awards.filter((a) => TEAM_AWARD_TYPES.has(a.awardType)).length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="team-awards">
          <h2 id="team-awards" className="home-section-title border-b border-[var(--ui-border)] pb-3 text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">수상 내역</h2>
          <AwardHistory awards={awards} />
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="team-recent-matches">
        <h2 id="team-recent-matches" className="home-section-title border-b border-[var(--ui-border)] pb-3 text-[length:var(--ui-title-size)] text-[var(--ui-ink)]">최근 경기</h2>

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
                className="inline-flex items-center gap-2 rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2.5 text-sm hover:bg-[var(--ui-surface-muted)]"
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
      </div>
    </main>
  );
}
