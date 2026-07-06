import Link from "next/link";
import { CalendarDays, Play } from "lucide-react";
import { predictMatchWinnerAction } from "@/app/matches/[matchId]/actions";
import {
  HomeHeroSwiper,
  type HomeHeroSwiperSlide,
} from "@/components/domain/home-hero-swiper";
import {
  HomeMatchCalendar,
  type HomeCalendarMatch,
} from "@/components/domain/home-match-calendar";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { isMatchLive } from "@/lib/match-display";
import { teams as themeTeams } from "@/lib/team-themes";
import type { FanMatchPrediction, Match, Team, TeamVideo } from "@/lib/types";
import { formatDateTime, matchHref } from "@/lib/view-data";
import type { CommunityPostDetail } from "@/lib/community/types";
import { SectionHeading as Heading } from "@/components/ui/section-heading";
import { AdSlot as Ad } from "@/components/ui/ad-slot";
import { TeamLogo as Logo } from "@/components/ui/team-logo";

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
  predictionsByMatchId: Map<string, FanMatchPrediction[]>;
  tournamentNamesById: Map<string, string>;
  calendarMonthKey: string;
  calendarMatches: HomeCalendarMatch[];
  latestVideos: TeamVideo[];
  heroSlides: HomeHeroSwiperSlide[];
  communityPosts: CommunityPostDetail[];
  stripMatches: Match[];
  stripTodayKey: string;
};

function CompactPrediction({
  match,
  teams,
  predictions,
}: {
  match: Match;
  teams: Map<string, Team>;
  predictions: FanMatchPrediction[];
}) {
  const a = teams.get(match.teamAId),
    b = teams.get(match.teamBId);
  const av = predictions.filter((p) => p.teamId === match.teamAId).length,
    bv = predictions.filter((p) => p.teamId === match.teamBId).length,
    total = av + bv;
  const ap = total ? Math.round((av / total) * 100) : 50;
  return (
    <div className="mt-3">
      <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-[#e4e2e8]">
        <span
          style={{ width: `${ap}%`, background: a?.primaryColor || "#1c192b" }}
        />
        <span
          className="flex-1"
          style={{ background: b?.primaryColor || "#777080" }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[a, b].map((team, index) => (
          <form
            action={predictMatchWinnerAction}
            key={`${match.id}-${team?.id ?? `tbd-${index}`}`}
          >
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="teamId" value={team?.id} />
            <button
              disabled={!team}
              className="w-full rounded-lg border border-[#dcd9e2] py-2 text-xs font-black hover:border-[#1c192b] hover:bg-[#f1eff5]"
            >
              {team?.shortName ?? "TBD"} 승리 예측
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function UpcomingCard({
  match,
  teams,
  predictions,
  tournament,
}: {
  match: Match;
  teams: Map<string, Team>;
  predictions: FanMatchPrediction[];
  tournament?: string;
}) {
  const a = teams.get(match.teamAId),
    b = teams.get(match.teamBId);
  return (
    <article className="h-[154px] overflow-hidden rounded-xl bg-[#fafafa] p-3 dark:border-[#e3e1e8] dark:border">
      <div className="flex justify-between text-xs font-semibold text-[#777b82]">
        <span>{tournament ?? match.name}</span>
        <span>{formatDateTime(match.matchDate)}</span>
      </div>
      <Link
        href={matchHref(match)}
        className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
      >
        <div className="flex items-center gap-2">
          <Logo team={a} size="h-8 w-8" plain />
          <b>{a?.shortName ?? "TBD"}</b>
        </div>
        <span className="text-xs font-black text-[#a0a3a8]">VS</span>
        <div className="flex items-center justify-end gap-2">
          <b>{b?.shortName ?? "TBD"}</b>
          <Logo team={b} size="h-8 w-8" plain />
        </div>
      </Link>
      <CompactPrediction
        match={match}
        teams={teams}
        predictions={predictions}
      />
    </article>
  );
}

function PredictionScore({
  match,
  teams,
  predictions,
}: {
  match: Match;
  teams: Map<string, Team>;
  predictions: FanMatchPrediction[];
}) {
  const a = teams.get(match.teamAId),
    b = teams.get(match.teamBId);
  const av = predictions.filter((item) => item.teamId === match.teamAId).length,
    bv = predictions.filter((item) => item.teamId === match.teamBId).length,
    total = av + bv;
  const ap = total ? Math.round((av / total) * 100) : 50;
  return (
    <div className="home-prediction-score mt-3">
      <div className="flex justify-between text-xs font-black">
        <span>
          {a?.shortName ?? "TBD"} {ap}%
        </span>
        <span>
          {100 - ap}% {b?.shortName ?? "TBD"}
        </span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#e4e2e8]">
        <span
          style={{ width: `${ap}%`, background: a?.primaryColor || "#18191c" }}
        />
        <span
          className="flex-1"
          style={{ background: b?.primaryColor || "#73767c" }}
        />
      </div>
    </div>
  );
}

function TodayMatchCard({
  match,
  teams,
  predictions,
}: {
  match: Match;
  teams: Map<string, Team>;
  predictions: FanMatchPrediction[];
}) {
  const a = teams.get(match.teamAId),
    b = teams.get(match.teamBId),
    live = isMatchLive(match),
    scheduled = match.status === "scheduled" && !live;
  return (
    <article className="rounded-2xl border border-[#e3e1e8] p-5">
      <div className="flex items-center text-sm font-bold text-[#85828e]">
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
        className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-5"
      >
        <div className="flex min-w-0 items-center justify-center gap-3">
          <Logo team={a} size="h-16 w-16" plain />
          <b className="min-w-0 truncate text-lg">{a?.shortName}</b>
        </div>
        <strong className="shrink-0 text-2xl">
          {scheduled
            ? "VS"
            : `${match.teamAScore ?? 0} : ${match.teamBScore ?? 0}`}
        </strong>
        <div className="flex min-w-0 flex-row-reverse items-center justify-center gap-3">
          <Logo team={b} size="h-16 w-16" plain />
          <b className="min-w-0 truncate text-lg">{b?.shortName}</b>
        </div>
      </Link>
      <PredictionScore match={match} teams={teams} predictions={predictions} />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href={matchHref(match)}
          className="rounded-lg bg-[#f1f0f4] py-2.5 text-center text-sm font-black"
        >
          매치정보 보기
        </Link>
        <Link
          href={`${matchHref(match)}?tab=rating`}
          className="rounded-lg bg-[#1c192b] py-2.5 text-center text-sm font-black text-white"
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
  predictionsByMatchId,
  tournamentNamesById,
  calendarMonthKey,
  calendarMatches,
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
  return (
    <main className="hub-home mx-auto w-full max-w-[1500px] px-5 pb-16 pt-7 text-[#1c192b] xl:px-10">
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <div className="h-[390px] min-w-0 overflow-hidden rounded-2xl bg-[#18191c]">
          <HomeHeroSwiper slides={heroSlides} />
        </div>
        <div className="h-[390px] overflow-hidden rounded-2xl border border-[#e3e1e8] bg-white p-4 dark:bg-[var(--ui-surface-muted)]">
          <div className="mb-3 flex items-center gap-2 text-[#18191c]">
            <CalendarDays size={20} />
            <h2 className="home-section-title text-xl">다가오는 경기</h2>
            <span className="ml-auto rounded-full bg-[#eeeeef] px-2 py-1 text-[11px] font-black text-[#18191c] dark:bg-[#2a2f35]">
              PREDICTION
            </span>
          </div>
          <div className="h-[330px] space-y-3 overflow-y-auto pr-1">
            {upcomingMatches.map((m) => (
              <UpcomingCard
                key={m.id}
                match={m}
                teams={byId}
                predictions={predictionsByMatchId.get(m.id) ?? []}
                tournament={tournamentNamesById.get(m.tournamentId)}
              />
            ))}
          </div>
        </div>
      </section>

      <Ad className="mt-8 h-24" />
      <section className="mt-8">
        <Heading href="/teams">팀 채널</Heading>
        <div className="grid grid-cols-5 gap-4 sm:grid-cols-10">
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
                  size="h-[76px] w-[76px] sm:h-[88px] sm:w-[88px] transition group-hover:-translate-y-1 group-hover:shadow-lg"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid items-stretch gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Heading href="/schedule">오늘의 매치</Heading>
          <div className="home-today-match-grid grid gap-4 md:grid-cols-2">
            {todayMatches.map((m) => (
              <TodayMatchCard
                key={m.id}
                match={m}
                teams={byId}
                predictions={predictionsByMatchId.get(m.id) ?? []}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          <Ad className="h-[305px]" />
        </div>
      </section>

      <section className="mt-10">
        <Heading href="/community">게시판</Heading>
        <HomeBoardCarousel posts={communityPosts} />
      </section>

      <section className="mt-10 grid items-stretch gap-4 xl:grid-cols-3">
        <div>
          <Heading>실시간 순위</Heading>
          <div className="h-[330px] overflow-hidden rounded-2xl border border-[#e6e7ea]">
            {standingRows.slice(0, 5).map((r) => (
              <Link
                href={`/teams/${r.team.slug}`}
                key={r.teamId}
                className="flex h-[66px] items-center gap-3 border-b border-[#efeff1] px-4 last:border-0"
              >
                <b className="w-5 text-center">{r.rank}</b>
                <Logo team={r.team} size="h-9 w-9" />
                <b className="flex-1 text-sm">{r.team.shortName}</b>
                <span className="text-sm font-bold">
                  {r.wins}승 {r.losses}패
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <Heading>팀 최근 폼</Heading>
          <div className="h-[330px] overflow-hidden rounded-2xl border border-[#e6e7ea]">
            {standingRows.slice(0, 5).map((r) => (
              <div
                key={r.teamId}
                className="flex h-[66px] items-center gap-3 border-b border-[#efeff1] px-4 last:border-0"
              >
                <Logo team={r.team} size="h-9 w-9" />
                <b className="flex-1 text-sm">{r.team.shortName}</b>
                <div className="flex gap-1">
                  {r.recent.map((v, i) => (
                    <span
                      key={i}
                      className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-white ${v === "W" ? "bg-[#00b979]" : "bg-[#b7bac0]"}`}
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
        <div>
          <Heading href="/schedule">경기 캘린더</Heading>
          <HomeMatchCalendar
            initialMonthKey={calendarMonthKey}
            matches={calendarMatches}
          />
        </div>
      </section>

      <section className="mt-10">
        <Heading href="/videos">최신 영상</Heading>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {latestVideos.slice(0, 4).map((v) => (
            <a
              key={v.id}
              href={v.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="group"
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#202124]">
                {v.thumbnailUrl && (
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full bg-[#00e58e]">
                  <Play size={16} fill="currentColor" />
                </span>
              </div>
              <b className="mt-3 line-clamp-2 block text-sm leading-5">
                {v.title}
              </b>
            </a>
          ))}
        </div>
        <Ad className="mt-8 h-24" />
      </section>
    </main>
  );
}
