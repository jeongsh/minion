import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { HomeHeroSwiper, type HomeHeroSwiperSlide } from "@/components/domain/home-hero-swiper";
import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeVideoSwiper } from "@/components/domain/home-video-swiper";
import { HomeMatchSwiper } from "@/components/domain/home-match-swiper";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { HomePomSwiper } from "@/components/domain/home-pom-swiper";
import { HomeWeeklyReportCard } from "@/components/domain/home-weekly-report-card";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { HomePomEntry } from "@/lib/data/home-pom";
import type { WeeklyReportSummary } from "@/lib/reports/queries";
import { teams as themeTeams } from "@/lib/team-themes";
import type { Team } from "@/lib/types";
import type { HomeVideo } from "@/lib/data/lck-channel-videos";
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
  matchItems: HomeMatchItem[];
  currentUserId?: string;
  predictionBalance: number | null;
  calendarMonthKey: string;
  calendarMatches: HomeCalendarMatch[];
  calendarEvents: CalendarEvent[];
  celebrationEvents: CalendarEvent[];
  latestVideos: HomeVideo[];
  heroSlides: HomeHeroSwiperSlide[];
  communityPosts: CommunityPostDetail[];
  pomEntries: HomePomEntry[];
  latestReport: WeeklyReportSummary | null;
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
  calendarMatches,
  calendarEvents,
  celebrationEvents,
  latestVideos,
  heroSlides,
  communityPosts,
  pomEntries,
  latestReport,
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

  return (
    <main className="layout-wide hub-home pb-16 pt-4 text-[#1c192b] sm:pt-7">
      {/* 상단 배너 + (lg 이상) 캘린더 / (그 아래) 매치 패널.
          배너 비율을 폭에 고정하면 좁은 화면에서 옆 캘린더와 높이가 어긋난다.
          캘린더는 292px(6주 고정 × 30px + 캡션/요일/범례) 아래로 못 줄어드는데,
          뷰포트 1280에서 배너 폭은 676px뿐이라 3.37:1이면 200px밖에 안 나온다.
          그래서 2열에서는 배너를 높이 기준(h-full)으로 두어 캘린더와 항상 맞추고,
          1열로 떨어지는 구간에서만 비율(5/2)로 잡는다. 2열일 때 배너의 실제 비율은
          폭에 따라 2.1~3.4:1 사이를 오가는데, 1열 비율 2.5:1이 그 범위 안이라
          브레이크포인트를 넘을 때 모양이 튀지 않는다. */}
      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="aspect-[5/2] min-w-0 lg:aspect-auto lg:h-[300px]">
          <HomeHeroSwiper slides={heroSlides} />
        </div>

        {/* lg 이상: 캘린더를 펼쳐 둔다. 높이 300px은 위 배너의 lg:h-[300px]와 같은 값이어야
            한다(둘 중 하나만 바꾸면 어긋난다). min-h로 두면 배너 이미지의 원본 비율이
            행 높이를 끌어올려(933px 폭에서 412px) 둘 다 늘어나므로 고정 높이여야 한다. */}
        <div className="hidden min-w-0 lg:block">
          <HomeCalendar
            initialMonthKey={calendarMonthKey}
            matches={calendarMatches}
            events={calendarEvents}
            heightClassName="h-[300px]"
          />
        </div>

        {/* 모바일: 캘린더를 펼치면 300px를 먹어 콘텐츠가 밀리므로, 원래대로 매치 패널을
            두고 캘린더는 버튼으로 모달을 띄운다. */}
        <div className="min-w-0 rounded-2xl border border-[#e3e1e8] bg-white p-3 sm:p-4 lg:hidden dark:bg-[var(--ui-surface-muted)]">
          <div className="mb-3 flex min-w-0 items-center gap-2 text-[#18191c]">
            <CalendarDays size={17} className="shrink-0" />
            <h2 className="home-section-title min-w-0 flex-1 text-[length:var(--ui-title-size)]">매치</h2>
            <AdaptiveDialog
              title="경기·기념일 캘린더"
              trigger={<span className="flex items-center gap-1.5"><CalendarDays size={16} />캘린더</span>}
              triggerClassName="flex min-h-10 shrink-0 items-center rounded-xl border border-[#e3e1e8] bg-white px-3 text-[12px] font-black text-[#18191c] dark:bg-[var(--ui-surface-muted)]"
            >
              <HomeCalendar
                initialMonthKey={calendarMonthKey}
                matches={calendarMatches}
                events={calendarEvents}
              />
            </AdaptiveDialog>
          </div>
          <HomeMatchSwiper
            items={matchItems}
            currentUserId={currentUserId}
            balance={predictionBalance}
            variant="single"
          />
        </div>
      </section>

      {celebrationEvents.length > 0 ? (
        <section className="mt-8">
          <CelebrationBanner events={celebrationEvents} />
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

      <Ad placement="horizontal" className="mt-8 hidden h-[60px] md:block xl:h-[90px]" />

      {/* 모바일에서는 위 상단 패널이 같은 matchItems를 보여주므로 중복을 피해 숨긴다. */}
      <section className="mt-8 hidden lg:block">
        <Heading href="/schedule">매치</Heading>
        <HomeMatchSwiper
          items={matchItems}
          currentUserId={currentUserId}
          balance={predictionBalance}
        />
      </section>

      {pomEntries.length > 0 ? (
        <section className="mt-8">
          <Heading href="/players" caption="공식 MVP">최근 POM</Heading>
          <HomePomSwiper entries={pomEntries} />
        </section>
      ) : null}

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
                className="overflow-hidden rounded-2xl border border-[#e6e7ea] bg-white dark:bg-[var(--ui-surface-muted)]"
              >
                {standingRows
                  .slice(column * STANDING_ROWS_PER_COLUMN, (column + 1) * STANDING_ROWS_PER_COLUMN)
                  .map((row) => (
                    <Link
                      href={`/teams/${row.team.slug}`}
                      key={row.teamId}
                      className="flex items-center gap-3 border-b border-[#efeff1] px-3 last:border-0 sm:px-4 dark:border-[#343840]"
                      style={{ minHeight: STANDING_ROW_HEIGHT }}
                    >
                      <b className="w-5 shrink-0 text-center text-[13px]">{row.rank}</b>
                      <Logo team={row.team} themeAware size="h-8 w-8 shrink-0" />
                      <b className="min-w-0 flex-1 truncate text-sm">{row.team.shortName}</b>
                      {/* 최근 폼은 예전에 별도 카드였는데, 같은 standingRows를 같은 순서로
                          한 번 더 그리는 것이라 순위표의 한 컬럼으로 합쳤다. */}
                      <div className="flex shrink-0 gap-1">
                        {row.recent.map((result, index) => (
                          <span
                            key={index}
                            className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-medium text-white ${result === "W" ? "bg-[#00b979]" : "bg-[#b7bac0] dark:bg-[#565861]"}`}
                            style={{ lineHeight: 1 }}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
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
        <Heading href="/community">게시판</Heading>
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
