import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { HomeCalendarWorkspace } from "@/components/domain/home-calendar-workspace";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeVideoSwiper } from "@/components/domain/home-video-swiper";
import { HomeMatchSwiper } from "@/components/domain/home-match-swiper";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { HomePomSwiper } from "@/components/domain/home-pom-swiper";
import { HomeNewsSection } from "@/components/news/home-news-section";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { HomePomEntry } from "@/lib/data/home-pom";
import { teams as themeTeams } from "@/lib/team-themes";
import type { Team } from "@/lib/types";
import type { HomeVideo } from "@/lib/data/lck-channel-videos";
import type { CommunityPostDetail } from "@/lib/community/types";
import type { NewsArticle } from "@/lib/data/news";
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
};

type Props = {
  teams: Team[];
  standingRows: HomeStandingRow[];
  matchItems: HomeMatchItem[];
  calendarMonthKey: string;
  calendarTodayKey: string;
  calendarMatches: HomeCalendarMatch[];
  calendarEvents: CalendarEvent[];
  celebrationEvents: CalendarEvent[];
  latestVideos: HomeVideo[];
  communityPosts: CommunityPostDetail[];
  communityTitle: "인기글" | "최신글";
  pomEntries: HomePomEntry[];
  newsItems: NewsArticle[];
};

/** 순위표는 10팀을 5+5 두 칼럼으로 나눈다. 옆 광고 높이도 이 값에서 계산한다. */
const STANDING_ROWS_PER_COLUMN = 5;
const STANDING_ROW_HEIGHT = 56;
const HOME_SECTION_SPACING = "mt-10";

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
  calendarMonthKey,
  calendarMatches,
  calendarEvents,
  celebrationEvents,
  latestVideos,
  communityPosts,
  communityTitle,
  pomEntries,
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
  return (
    <main className="layout-wide hub-home pb-16 pt-4 text-[var(--ui-ink)] sm:pt-7">
      <section aria-label="매치" className="mb-8">
        <HomeMatchSwiper items={matchItems} />
        <div className="mt-3 xl:hidden">
          <AdaptiveDialog
            title="LCK 캘린더"
            trigger={
              <>
                <CalendarDays className="size-4" strokeWidth={2} />
                월간 캘린더 보기
              </>
            }
            triggerClassName="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ui-card-bg)] px-4 text-sm font-bold text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)]"
            triggerAriaLabel="LCK 캘린더 열기"
            panelClassName="sm:max-w-[400px]"
          >
            <HomeCalendar
              initialMonthKey={calendarMonthKey}
              matches={calendarMatches}
              events={calendarEvents}
            />
          </AdaptiveDialog>
        </div>
      </section>

      {celebrationEvents.length > 0 ? (
        <section className="my-8">
          <CelebrationBanner events={celebrationEvents} />
        </section>
      ) : null}
      <HomeNewsSection articles={newsItems} />

      <Ad
        placement="horizontal"
        format="auto"
        className="mt-8 h-[100px] sm:mt-10 md:h-[60px] xl:h-[90px]"
      />

      <section className="mt-10">
        <Heading href={communityTitle === "인기글" ? "/community?view=hot" : "/community"}>{communityTitle}</Heading>
        <HomeBoardCarousel posts={communityPosts} />
      </section>

      {pomEntries.length > 0 ? (
        <section className={HOME_SECTION_SPACING}>
          <Heading href="/players" caption="공식 MVP">최근 POM</Heading>
          <HomePomSwiper entries={pomEntries} />
        </section>
      ) : null}

      <section className={HOME_SECTION_SPACING}>
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

      <section className={`${HOME_SECTION_SPACING} hidden gap-4 xl:grid xl:grid-cols-3`}>
        <div className="min-w-0 xl:col-span-2">
          <Heading>LCK 현황</Heading>
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
                      href={`/teams?team=${encodeURIComponent(row.team.fanSiteHost || row.team.slug)}`}
                      key={row.teamId}
                      className="flex items-center gap-3 border-b border-[var(--ui-border)] px-3 last:border-0 sm:px-4"
                      style={{ minHeight: STANDING_ROW_HEIGHT }}
                    >
                      <b className="w-5 shrink-0 text-center text-[13px]">{row.rank}</b>
                      <Logo team={row.team} themeAware size="h-8 w-8 shrink-0" />
                      <b className="min-w-0 flex-1 truncate text-sm">{row.team.shortName}</b>
                      <span className="shrink-0 text-[13px] text-[var(--ui-muted)]">{row.setDiff >= 0 ? `+${row.setDiff}` : row.setDiff}</span>
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
          <HomeCalendarWorkspace
            initialMonthKey={calendarMonthKey}
            matches={calendarMatches}
            events={calendarEvents}
            compactOnDesktop
          />
        </div>
      </section>

      <section className={HOME_SECTION_SPACING}>
        <Heading>최신 영상</Heading>
        <HomeVideoSwiper videos={latestVideos} />
        <Ad
          placement="horizontal"
          format="auto"
          className="mt-10 h-[100px] md:h-[60px] xl:h-[90px]"
        />
      </section>
    </main>
  );
}
