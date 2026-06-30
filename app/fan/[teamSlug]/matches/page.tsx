import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getAllTeams,
  getMatches,
  getStages,
  getTeamByFanSiteHost,
  getTeamBySlug,
  getTournaments,
} from "@/lib/data/lck";
import { stageName, tournamentTypeLabel } from "@/lib/match-display";
import { filterMatchesBySegment, parseSeasonSegment } from "@/lib/tournament-filters";
import type { Match, Stage, Team, Tournament } from "@/lib/types";
import {
  formatTimeKST,
  getMonthKST,
  getYearKST,
  KST_TIMEZONE,
  matchHref,
} from "@/lib/view-data";

import { FanMatchFilters } from "./fan-match-filters";

export const dynamic = "force-dynamic";

type TeamView = {
  match: Match;
  opponent?: Team;
  ourScore: number | null;
  oppScore: number | null;
  result: "win" | "loss" | null;
};

function buildTeamView(match: Match, team: Team, teams: Team[]): TeamView {
  const isTeamA = match.teamAId === team.id;
  const opponentId = isTeamA ? match.teamBId : match.teamAId;
  const ourScore = isTeamA ? match.teamAScore : match.teamBScore;
  const oppScore = isTeamA ? match.teamBScore : match.teamAScore;
  const result =
    match.status === "completed" && match.winnerTeamId
      ? match.winnerTeamId === team.id
        ? "win"
        : "loss"
      : null;

  return {
    match,
    opponent: teams.find((item) => item.id === opponentId),
    ourScore,
    oppScore,
    result,
  };
}

function dDayLabel(matchDate: string, now: number) {
  const diffDays = Math.ceil((new Date(matchDate).getTime() - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "오늘";
  if (diffDays === 1) return "내일";
  return `D-${diffDays}`;
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function currentKSTYear() {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: KST_TIMEZONE, year: "numeric" }).format(new Date()),
  );
}

function TeamCrest({ team, size = "h-9 w-9" }: { team?: Team; size?: string }) {
  if (team?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logoUrl} alt="" className={`${size} shrink-0 object-contain`} />;
  }

  return (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-full border border-[#e6e9ef] bg-[#f4f5f8] text-[10px] font-bold`}
    >
      {team?.shortName?.slice(0, 3) ?? "-"}
    </span>
  );
}

function FeaturedMatch({
  team,
  view,
  mode,
  tournaments,
  now,
}: {
  team: Team;
  view: TeamView;
  mode: "live" | "upcoming" | "recent";
  tournaments: Tournament[];
  now: number;
}) {
  const badge = mode === "live" ? "LIVE" : mode === "upcoming" ? "다음 경기" : "최근 결과";
  const tournament = tournaments.find((item) => item.id === view.match.tournamentId);

  return (
    <Link
      href={matchHref(view.match)}
      className="group flex flex-col gap-4 rounded-3xl border border-[#e6e9ef] bg-white p-5 shadow-sm transition hover:border-accent sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex items-center gap-4">
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black tracking-[0.1em] ${
            mode === "live" ? "bg-red-500 text-white" : "bg-accent/10 text-accent"
          }`}
        >
          {badge}
        </span>
        <div className="flex items-center gap-2.5">
          <TeamCrest team={team} size="h-11 w-11" />
          <span className="text-lg font-black">{team.shortName}</span>
          <span className="px-1 text-base font-black tabular-nums text-muted">
            {view.result ? `${view.ourScore} : ${view.oppScore}` : "VS"}
          </span>
          <TeamCrest team={view.opponent} size="h-11 w-11" />
          <span className="text-lg font-black">{view.opponent?.shortName ?? "-"}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-sm">
          <p className="font-bold">
            {dayLabel(view.match.matchDate)} {formatTimeKST(view.match.matchDate)}
          </p>
          <p className="text-xs text-muted">{tournamentTypeLabel(tournament)}</p>
        </div>
        <span className="shrink-0 text-sm font-black text-accent">
          {mode === "upcoming" ? dDayLabel(view.match.matchDate, now) : "상세 →"}
        </span>
      </div>
    </Link>
  );
}

function MatchRow({
  view,
  team,
  stages,
  now,
}: {
  view: TeamView;
  team: Team;
  stages: Stage[];
  now: number;
}) {
  const { match, opponent, ourScore, oppScore, result } = view;

  return (
    <Link
      href={matchHref(match)}
      className="flex items-center gap-3 px-4 py-4 transition hover:bg-[#f8f9fb] sm:gap-5 sm:px-5"
    >
      {/* 날짜 */}
      <div className="w-16 shrink-0 sm:w-20">
        <p className="text-sm font-black">{dayLabel(match.matchDate)}</p>
        <p className="mt-0.5 text-xs text-muted">{formatTimeKST(match.matchDate)}</p>
      </div>

      {/* 우리 팀 vs 상대 */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <TeamCrest team={team} />
        <span className="hidden text-sm font-bold sm:inline">{team.shortName}</span>
        <span className="mx-1 shrink-0 text-base font-black tabular-nums sm:mx-2">
          {result ? `${ourScore} : ${oppScore}` : "vs"}
        </span>
        <TeamCrest team={opponent} />
        <span className="min-w-0 truncate text-sm font-bold">{opponent?.shortName ?? "-"}</span>
      </div>

      {/* 스테이지 */}
      <div className="hidden min-w-0 shrink-0 text-right md:block">
        <p className="truncate text-xs text-muted">{stageName(stages, match.stageId)}</p>
      </div>

      {/* 결과 / 상태 pill */}
      <div className="w-14 shrink-0 text-right sm:w-16">
        {result === "win" ? (
          <span className="inline-block rounded-md bg-emerald-500/12 px-2.5 py-1 text-xs font-black text-emerald-600">
            승
          </span>
        ) : result === "loss" ? (
          <span className="inline-block rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-500">
            패
          </span>
        ) : match.status === "live" ? (
          <span className="inline-block rounded-md bg-red-500 px-2.5 py-1 text-xs font-black text-white">
            LIVE
          </span>
        ) : (
          <span className="inline-block rounded-md bg-accent/10 px-2.5 py-1 text-xs font-black text-accent">
            {dDayLabel(match.matchDate, now)}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function FanMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ year?: string; month?: string; segment?: string }>;
}) {
  const { teamSlug } = await params;
  const sp = await searchParams;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const [teams, matches, tournaments, stages] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getTournaments(),
    getStages(),
  ]);

  // force-dynamic 페이지: D-day/예정 표시를 위해 요청 시각 사용
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const teamMatches = matches.filter(
    (match) => match.teamAId === team.id || match.teamBId === team.id,
  );

  // 필터: 기본값은 해당 연도 · 월 전체 · 대회 전체
  const defaultYear = currentKSTYear();
  const activeYear = sp.year ? Number(sp.year) : defaultYear;
  const activeMonth = sp.month ?? "all";
  const activeSegment = parseSeasonSegment(sp.segment);

  const years = Array.from(
    new Set([
      ...tournaments
        .map((tournament) => tournament.season)
        .filter((season): season is number => Boolean(season)),
      activeYear,
    ]),
  ).sort((a, b) => b - a);

  const segmentMatches = filterMatchesBySegment(teamMatches, tournaments, activeSegment, activeYear);
  const filtered = segmentMatches
    .filter(
      (match) =>
        getYearKST(match.matchDate) === activeYear &&
        (activeMonth === "all" || getMonthKST(match.matchDate) === Number(activeMonth)),
    )
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  // 대회별 그룹 (경기 날짜 순서대로 그룹 생성)
  const groups = new Map<string, { tournament?: Tournament; views: TeamView[] }>();
  for (const match of filtered) {
    const group = groups.get(match.tournamentId);
    const view = buildTeamView(match, team, teams);

    if (group) {
      group.views.push(view);
    } else {
      groups.set(match.tournamentId, {
        tournament: tournaments.find((item) => item.id === match.tournamentId),
        views: [view],
      });
    }
  }

  // 상단 하이라이트: 실제 진행/다음/최근 경기 (필터와 무관)
  const sortedAll = [...teamMatches].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );
  const liveMatch = sortedAll.find((match) => match.status === "live");
  const nextMatch = sortedAll.find(
    (match) => match.status === "scheduled" && new Date(match.matchDate).getTime() >= now,
  );
  const recentMatch = [...sortedAll].reverse().find((match) => match.status === "completed");
  const featuredMatch = liveMatch ?? nextMatch ?? recentMatch;
  const featuredMode = liveMatch ? "live" : nextMatch ? "upcoming" : "recent";

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 py-6 sm:px-6 md:py-8">
      {featuredMatch ? (
        <FeaturedMatch
          team={team}
          view={buildTeamView(featuredMatch, team, teams)}
          mode={featuredMode}
          tournaments={tournaments}
          now={now}
        />
      ) : null}

      <Suspense fallback={null}>
        <FanMatchFilters
          activeYear={activeYear}
          activeMonth={activeMonth}
          activeSegment={activeSegment}
          years={years}
        />
      </Suspense>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface px-5 py-12 text-center text-sm text-muted">
          {activeYear}년{activeMonth === "all" ? "" : ` ${activeMonth}월`} 조건에 해당하는 경기가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.values()].map(({ tournament, views }) => (
            <section
              key={tournament?.id ?? views[0]?.match.id}
              className="overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#eef0f4] bg-[#f8f9fb] px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
                    {tournamentTypeLabel(tournament)}
                  </p>
                  <h2 className="truncate text-sm font-black text-foreground">
                    {tournament?.name ?? "기타 경기"}
                  </h2>
                </div>
                <span className="shrink-0 text-xs font-bold text-muted">{views.length}경기</span>
              </div>
              <div className="divide-y divide-[#eef0f4]">
                {views.map((view) => (
                  <MatchRow key={view.match.id} view={view} team={team} stages={stages} now={now} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
