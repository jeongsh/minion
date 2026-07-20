import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { HomeUpcomingMatchesSwiper } from "@/components/domain/home-upcoming-matches-swiper";
import {
  HomeHeroSwiper,
  type HomeHeroSwiperSlide,
} from "@/components/domain/home-hero-swiper";
import {
  HomeCalendar,
  type HomeCalendarMatch,
} from "@/components/domain/home-calendar";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeVideoSwiper } from "@/components/domain/home-video-swiper";
import { HomeTodayMatchesSwiper } from "@/components/domain/home-today-matches-swiper";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { CalendarEvent } from "@/lib/calendar/events";
import { isMatchLive } from "@/lib/match-display";
import { teams as themeTeams } from "@/lib/team-themes";
import { predictionMarketForMatch, type PredictionBet } from "@/lib/predictions";
import type { Match, Team } from "@/lib/types";
import type { HomeVideo } from "@/lib/data/lck-channel-videos";
import { formatDateTime, matchHref } from "@/lib/view-data";
import type { CommunityPostDetail } from "@/lib/community/types";
import { SectionHeading as Heading } from "@/components/ui/section-heading";
import { AdSlot as Ad } from "@/components/ui/ad-slot";
import { TeamLogo as Logo } from "@/components/ui/team-logo";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";

export type HomeStandingRow = {
  team: Team;
  teamId: string;
  rank: number;
  wins: number;
  losses: number;
  setDiff: number;
  recent: Array<"W" | "L">;
};
type Props = {
  teams: Team[];
  standingRows: HomeStandingRow[];
  upcomingMatches: Match[];
  recentMatches: Match[];
  todayMatches: Match[];
  predictionBetsByMatchId: Map<string, PredictionBet[]>;
  currentUserId?: string;
  predictionBalance: number | null;
  tournamentNamesById: Map<string, string>;
  calendarMonthKey: string;
  calendarMatches: HomeCalendarMatch[];
  calendarEvents: CalendarEvent[];
  celebrationEvents: CalendarEvent[];
  latestVideos: HomeVideo[];
  heroSlides: HomeHeroSwiperSlide[];
  communityPosts: CommunityPostDetail[];
  stripMatches: Match[];
  stripTodayKey: string;
};

function PredictionScore({ match, teams, bets }: { match: Match; teams: Map<string, Team>; bets: PredictionBet[] }) {
  const a = teams.get(match.teamAId), b = teams.get(match.teamBId);
  const market = predictionMarketForMatch(bets, match.id, match.teamAId, match.teamBId);
  return <div className="home-prediction-score mt-3"><div className="flex justify-between text-[13px] font-black"><span>{a?.shortName ?? "TBD"} {market.teamAPercent}%</span><span>{market.teamBPercent}% {b?.shortName ?? "TBD"}</span></div><div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#e4e2e8]"><span style={{width:`${market.teamAPercent}%`,background:a?.primaryColor||"#18191c"}}/><span className="flex-1" style={{background:b?.primaryColor||"#73767c"}}/></div></div>;
}

function TodayMatchCard({
  match,
  teams,
  bets,
}: {
  match: Match;
  teams: Map<string, Team>;
  bets: PredictionBet[];
}) {
  const a = teams.get(match.teamAId),
    b = teams.get(match.teamBId),
    live = isMatchLive(match),
    scheduled = match.status === "scheduled" && !live;
  return (
    <article className="rounded-2xl border border-[#e3e1e8] p-3 lg:p-4 xl:p-5">
      <div className="flex items-center text-[13px] font-bold text-[#85828e] xl:text-sm">
        {live ? (
          <span className="rounded-full bg-[#ff3158] px-2 py-1 text-white">
            LIVE
          </span>
        ) : (
          <span>{scheduled ? "경기 전" : "경기 종료"}</span>
        )}
        <span className="ml-auto">{formatDateTime(match.matchDate)}</span>
      </div>
      <Link
        href={matchHref(match)}
        className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 xl:mt-5 xl:gap-5"
      >
        <div className="flex min-w-0 items-center justify-center gap-3">
          <Logo team={a} size="h-9 w-9 lg:h-11 lg:w-11 xl:h-16 xl:w-16" plain />
          <b className="min-w-0 truncate text-sm lg:text-base xl:text-lg">{a?.shortName}</b>
        </div>
        <strong className="shrink-0 text-lg xl:text-2xl">
          {scheduled
            ? "VS"
            : `${match.teamAScore ?? 0} : ${match.teamBScore ?? 0}`}
        </strong>
        <div className="flex min-w-0 flex-row-reverse items-center justify-center gap-3">
          <Logo team={b} size="h-9 w-9 lg:h-11 lg:w-11 xl:h-16 xl:w-16" plain />
          <b className="min-w-0 truncate text-sm lg:text-base xl:text-lg">{b?.shortName}</b>
        </div>
      </Link>
      <PredictionScore match={match} teams={teams} bets={bets} />
      <div className="mt-3 grid grid-cols-2 gap-2 xl:mt-4">
        <Link
          href={matchHref(match)}
          className="rounded-lg bg-[#f1f0f4] px-2 py-2 text-center text-[13px] font-black xl:py-2.5 xl:text-sm"
        >
          매치정보 보기
        </Link>
        <Link
          href={`${matchHref(match)}?tab=rating`}
          className="rounded-lg bg-[#1c192b] px-2 py-2 text-center text-[13px] font-black text-white xl:py-2.5 xl:text-sm"
        >
          평점 보기
        </Link>
      </div>
    </article>
  );
}

export function HomeDashboard({
  teams,
  standingRows,
  upcomingMatches,
  todayMatches,
  predictionBetsByMatchId,
  currentUserId,
  predictionBalance,
  tournamentNamesById,
  calendarMonthKey,
  calendarMatches,
  calendarEvents,
  celebrationEvents,
  latestVideos,
  heroSlides,
  communityPosts,
}: Props) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const activeTeams = themeTeams
    .map(
      (theme) =>
        teams.find(
          (team) =>
            team.id === theme.id ||
            team.slug === theme.slug ||
            team.fanSiteHost === theme.fanSiteHost,
        ) ?? theme,
    )
    .slice(0, 10);
  const upcomingItems = upcomingMatches.map((m) => ({
    match: m,
    teamA: byId.get(m.teamAId),
    teamB: byId.get(m.teamBId),
    tournament: tournamentNamesById.get(m.tournamentId),
    bets: predictionBetsByMatchId.get(m.id) ?? [],
  }));

  return (
    <main className="layout-wide hub-home pb-16 pt-4 text-[#1c192b] sm:pt-7">
      <section className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.55fr)_360px] xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <div className="aspect-video min-w-0 overflow-hidden rounded-xl bg-[#18191c] sm:aspect-auto sm:h-[240px] md:h-[260px] lg:h-[280px] sm:rounded-2xl xl:h-[390px]">
          <HomeHeroSwiper slides={heroSlides} />
        </div>
        <div className="min-w-0 rounded-2xl border border-[#e3e1e8] bg-white p-3 sm:p-4 xl:h-[390px] xl:overflow-y-auto dark:bg-[var(--ui-surface-muted)]">
          <div className="mb-3 flex min-w-0 items-center gap-2 text-[#18191c]">
            <CalendarDays size={17} className="shrink-0" />
            <h2 className="home-section-title min-w-0 flex-1 text-xl">다가오는 매치</h2>
            <AdaptiveDialog title="경기·기념일 캘린더" trigger={<span className="flex items-center gap-1.5"><CalendarDays size={16} />캘린더</span>} triggerClassName="flex min-h-10 shrink-0 items-center rounded-xl border border-[#e3e1e8] bg-white px-3 text-[12px] font-black text-[#18191c] md:hidden dark:bg-[var(--ui-surface-muted)]"><HomeCalendar initialMonthKey={calendarMonthKey} matches={calendarMatches} events={calendarEvents} /></AdaptiveDialog>
          </div>
          <HomeUpcomingMatchesSwiper
            items={upcomingItems}
            currentUserId={currentUserId}
            balance={predictionBalance}
          />
        </div>
      </section>

      {celebrationEvents.length > 0 ? (
        <section className="mt-6">
          <CelebrationBanner events={celebrationEvents} />
        </section>
      ) : null}

      <Ad placement="horizontal" className="mt-4 hidden h-[60px] md:block xl:mt-8 xl:h-[90px]" />
      <section className="mt-7 md:hidden">
        <Heading href="/schedule">오늘의 매치</Heading>
        {todayMatches.length > 0 ? (
          <div className="grid gap-3">
            {todayMatches.slice(0, 2).map((m) => (
              <TodayMatchCard
                key={m.id}
                match={m}
                teams={byId}
                bets={predictionBetsByMatchId.get(m.id) ?? []}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e6e7ea] bg-white p-4 text-sm font-bold text-[#686b72] dark:bg-[var(--ui-surface-muted)]">
            오늘 예정된 경기가 없습니다.
          </div>
        )}
      </section>

      <section className="mt-7 sm:mt-8">
        <Heading href="/teams">팀 채널</Heading>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-3 xl:gap-4">
          {activeTeams.map((team) => {
            const slug =
              themeTeams.find((t) => t.id === team.id)?.fanSiteHost ??
              team.slug;
            return (
              <Link
                key={team.id}
                href={`/fan/${slug}`}
                title={team.name}
                className="group flex justify-center"
              >
                <Logo
                  team={team}
                  themeAware
                  size="h-11 w-11 transition group-hover:-translate-y-1 group-hover:shadow-lg sm:h-12 sm:w-12 xl:h-16 xl:w-16"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-8 hidden items-start gap-4 md:grid sm:mt-10 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Heading href="/schedule">오늘의 매치</Heading>
          {todayMatches.length > 2 ? (
            <HomeTodayMatchesSwiper
              slides={todayMatches.map((m) => ({
                id: m.id,
                node: (
                  <TodayMatchCard
                    match={m}
                    teams={byId}
                    bets={predictionBetsByMatchId.get(m.id) ?? []}
                  />
                ),
              }))}
            />
          ) : (
            <div className="home-today-match-grid grid gap-4 md:grid-cols-2">
              {todayMatches.map((m) => (
                <TodayMatchCard
                  key={m.id}
                  match={m}
                  teams={byId}
                  bets={predictionBetsByMatchId.get(m.id) ?? []}
                />
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex flex-col">
          <Ad placement="rectangle" className="h-[60px] md:h-[90px] xl:h-[250px]" />
        </div>
      </section>

      <section className="mt-8 sm:mt-10">
        <Heading href="/community">게시판</Heading>
        <HomeBoardCarousel posts={communityPosts} />
      </section>

      <section className="mt-8 md:hidden">
        <div className="mb-3 flex items-center justify-between [&>button]:hidden">
          <Heading href="/tournaments">실시간 순위</Heading>
          <AdaptiveDialog title="경기·기념일 캘린더" trigger={<span className="flex items-center gap-1.5"><CalendarDays size={18} />캘린더</span>} triggerClassName="mb-3 flex min-h-10 items-center rounded-xl border border-[#e3e1e8] bg-white px-3 text-[12px] font-black dark:bg-[var(--ui-surface-muted)]"><HomeCalendar initialMonthKey={calendarMonthKey} matches={calendarMatches} events={calendarEvents} /></AdaptiveDialog>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#e6e7ea] bg-white dark:bg-[var(--ui-surface-muted)]">
          {standingRows.slice(0, 4).map((row) => <Link href={`/teams/${row.team.slug}`} key={row.teamId} className="grid min-h-14 grid-cols-[24px_34px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#efeff1] px-3 last:border-0"><b className="text-center text-[13px]">{row.rank}</b><Logo team={row.team} themeAware size="h-8 w-8" /><b className="truncate text-[14px]">{row.team.shortName}</b><span className="text-[13px] font-bold text-[#686b72]">{row.wins}승 {row.losses}패</span></Link>)}
        </div>
      </section>

      <section className="mt-8 hidden items-stretch gap-4 sm:mt-10 md:grid md:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col">
          <Heading>실시간 순위</Heading>
          <div className="grid flex-1 grid-rows-5 overflow-hidden rounded-2xl border border-[#e6e7ea]">
            {standingRows.slice(0, 5).map((r) => (
              <Link
                href={`/teams/${r.team.slug}`}
                key={r.teamId}
                className="flex min-h-12 items-center gap-2.5 border-b border-[#efeff1] px-3 last:border-0 lg:min-h-14 sm:gap-3 sm:px-4 xl:min-h-0"
              >
                <b className="w-5 text-center">{r.rank}</b>
                <Logo team={r.team} themeAware size="h-7 w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10" />
                <b className="min-w-0 flex-1 truncate text-[13px] sm:text-sm">{r.team.shortName}</b>
                <span className="shrink-0 text-[13px] font-bold sm:text-sm">
                  {r.wins}승 {r.losses}패
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <Heading>팀 최근 폼</Heading>
          <div className="grid flex-1 grid-rows-5 overflow-hidden rounded-2xl border border-[#e6e7ea]">
            {standingRows.slice(0, 5).map((r) => (
              <div
                key={r.teamId}
                className="flex min-h-12 items-center gap-2.5 border-b border-[#efeff1] px-3 last:border-0 lg:min-h-14 sm:gap-3 sm:px-4 xl:min-h-0"
              >
                <Logo team={r.team} themeAware size="h-7 w-7 lg:h-8 lg:w-8 xl:h-10 xl:w-10" />
                <b className="min-w-0 flex-1 truncate text-[13px] sm:text-sm">{r.team.shortName}</b>
                <div className="flex shrink-0 gap-1">
                  {r.recent.map((v, i) => (
                    <span
                      key={i}
                      className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-medium text-white xl:h-8 xl:w-8 xl:text-[13px] ${v === "W" ? "bg-[#00b979]" : "bg-[#b7bac0] dark:bg-[#565861]"}`}
                      style={{lineHeight: `1`}}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col md:col-span-2 xl:col-span-1">
          <Heading href="/schedule">캘린더</Heading>
          <HomeCalendar
            initialMonthKey={calendarMonthKey}
            matches={calendarMatches}
            events={calendarEvents}
          />
        </div>
      </section>

      <section className="mt-8 sm:mt-10">
        <Heading>최신 영상</Heading>
        <HomeVideoSwiper videos={latestVideos} />
        <Ad placement="horizontal" className="mt-8 hidden h-[60px] md:block xl:h-[90px]" />
      </section>
    </main>
  );
}
