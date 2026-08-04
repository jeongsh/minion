import Link from "next/link";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import { HomeCalendarWorkspace } from "@/components/domain/home-calendar-workspace";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeVideoSwiper } from "@/components/domain/home-video-swiper";
import { HomeMatchSwiper } from "@/components/domain/home-match-swiper";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { HomePomSwiper } from "@/components/domain/home-pom-swiper";
import { HomeWeeklyReportCard } from "@/components/domain/home-weekly-report-card";
import { HomeNewsSection } from "@/components/news/home-news-section";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { HomePomEntry } from "@/lib/data/home-pom";
import type { WeeklyReportSummary } from "@/lib/reports/queries";
import { teams as themeTeams } from "@/lib/team-themes";
import type { Team } from "@/lib/types";
import type { HomeVideo } from "@/lib/data/lck-channel-videos";
import type { CommunityPostDetail } from "@/lib/community/types";
import type { NewsArticle } from "@/lib/data/news";
import { isMatchLive } from "@/lib/match-display";
import { matchHref } from "@/lib/view-data";
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
};

type Props = {
  teams: Team[];
  standingRows: HomeStandingRow[];
  matchItems: HomeMatchItem[];
  currentUserId?: string;
  predictionBalance: number | null;
  calendarMonthKey: string;
  calendarTodayKey: string;
  calendarMatches: HomeCalendarMatch[];
  calendarEvents: CalendarEvent[];
  celebrationEvents: CalendarEvent[];
  latestVideos: HomeVideo[];
  communityPosts: CommunityPostDetail[];
  pomEntries: HomePomEntry[];
  latestReport: WeeklyReportSummary | null;
  newsItems: NewsArticle[];
};

/** 순위표는 10팀을 5+5 두 칼럼으로 나눈다. 옆 광고 높이도 이 값에서 계산한다. */
const STANDING_ROWS_PER_COLUMN = 5;
const STANDING_ROW_HEIGHT = 52;

/**
 * 옆 칼럼의 섹션 제목과 같은 높이를 차지해 두 칼럼의 카드 상단을 맞춘다.
 * 예전엔 mt-[47px] 매직넘버였는데 제목 크기를 바꿀 때마다 어긋났다.
 * 같은 Heading을 숨겨서 넣으면 --ui-title-size가 바뀌어도 자동으로 따라간다.
 */
function HeadingSpacer() {
  return (
    <div className="invisible" aria-hidden>
      <Heading>&nbsp;</Heading>
    </div>
  );
}

export function HomeDashboard({
  teams,
  standingRows,
  matchItems,
  currentUserId,
  predictionBalance,
  calendarMonthKey,
  calendarTodayKey,
  calendarMatches,
  calendarEvents,
  celebrationEvents,
  latestVideos,
  communityPosts,
  pomEntries,
  latestReport,
  newsItems,
}: Props) {
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
  const liveMatchItem = matchItems.find((item) => isMatchLive(item.match));

  return (
    <main className="layout-wide hub-home pb-16 pt-4 text-[var(--ui-ink)] sm:pt-7">
      {liveMatchItem ? (
        <Link
          href={matchHref(liveMatchItem.match)}
          className="mb-4 flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-[#ff3158] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#e9274d] sm:px-4"
        >
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-[#ff3158]">
            LIVE
          </span>
          <span className="min-w-0 flex-1 truncate">
            {liveMatchItem.teamA?.shortName ?? "TBD"} {liveMatchItem.match.teamAScore ?? 0}
            <span className="px-1.5 opacity-70">:</span>
            {liveMatchItem.match.teamBScore ?? 0} {liveMatchItem.teamB?.shortName ?? "TBD"}
          </span>
          <span className="shrink-0 text-xs sm:text-sm">경기 보기</span>
        </Link>
      ) : null}

      <HomeNewsSection articles={newsItems} />

      {celebrationEvents.length > 0 ? (
        <section className="mt-6">
          <CelebrationBanner events={celebrationEvents} />
        </section>
      ) : null}

      <section className="mt-8">
        <Heading href="/schedule">매치</Heading>
        <HomeMatchSwiper
          items={matchItems}
          currentUserId={currentUserId}
          balance={predictionBalance}
        />
      </section>

      <section className="mt-8">
        <Heading href="/schedule">LCK 일정</Heading>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <HomeCalendarWorkspace
            initialMonthKey={calendarMonthKey}
            initialDateKey={calendarTodayKey}
            matches={calendarMatches}
            events={calendarEvents}
          />

          <div className="hidden h-[300px] lg:block">
            <Ad placement="rectangle" className="h-full" />
          </div>
        </div>
      </section>

      {pomEntries.length > 0 ? (
        <section className="mt-8">
          <Heading href="/players" caption="공식 MVP">최근 POM</Heading>
          <HomePomSwiper entries={pomEntries} />
        </section>
      ) : null}

      <section className="mt-8">
        <Heading href="/teams">팀 채널</Heading>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-3 xl:gap-4">
          {activeTeams.map((team) => {
            const slug =
              themeTeams.find((t) => t.id === team.id)?.fanSiteHost ?? team.slug;
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

      <section className="mt-8 grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Heading href="/tournaments">실시간 순위</Heading>
          {/* 10팀을 5+5로 나눠 좌우에 둔다. 세로로 10줄을 쌓으면 520px라 옆 칼럼이
              비는데, 5줄(STANDING_ROWS_PER_COLUMN × 52px = 260px)로 맞추면
              옆 광고 영역과 높이가 떨어진다. */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((column) => (
              <div
                key={column}
                className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] dark:bg-[var(--ui-surface-muted)]"
              >
                {standingRows
                  .slice(column * STANDING_ROWS_PER_COLUMN, (column + 1) * STANDING_ROWS_PER_COLUMN)
                  .map((row) => (
                    <Link
                      href={`/teams/${row.team.slug}`}
                      key={row.teamId}
                      className="flex items-center gap-3 border-b border-[var(--ui-border)] px-3 last:border-0 sm:px-4"
                      style={{ minHeight: STANDING_ROW_HEIGHT }}
                    >
                      <b className="w-5 shrink-0 text-center text-[13px]">{row.rank}</b>
                      <Logo team={row.team} themeAware size="h-8 w-8 shrink-0" />
                      <b className="min-w-0 flex-1 truncate text-sm">{row.team.shortName}</b>
                      <span className="shrink-0 text-sm font-bold">
                        {row.wins}승 {row.losses}패
                      </span>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="hidden xl:block">
            <HeadingSpacer />
          </div>
          {/* 순위 카드와 같은 높이를 잡는다. AdSlot은 style을 받지 않아 래퍼로 높이를 준다. */}
          <div
            className="hidden md:block"
            style={{ height: STANDING_ROWS_PER_COLUMN * STANDING_ROW_HEIGHT }}
          >
            <Ad placement="rectangle" className="h-full" />
          </div>
        </div>
      </section>

      {latestReport ? (
        <section className="mt-8">
          <HomeWeeklyReportCard report={latestReport} />
        </section>
      ) : null}

      <section className="mt-8">
        <Heading href="/community">인기글</Heading>
        <HomeBoardCarousel posts={communityPosts} />
      </section>

      <section className="mt-8">
        <Heading>최신 영상</Heading>
        <HomeVideoSwiper videos={latestVideos} />
        <Ad placement="horizontal" className="mt-8 hidden h-[60px] md:block xl:h-[90px]" />
      </section>
    </main>
  );
}
