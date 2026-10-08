import Link from "next/link";
import { HomeTournamentOverview, type HomeTournamentOption } from "@/components/domain/home-tournament-overview";
import type { HomeTournamentOverview as Overview } from "@/lib/tournaments/home-overview";
import { CalendarDays } from "lucide-react";
import { HomeCalendar, type HomeCalendarMatch } from "@/components/domain/home-calendar";
import { HomeCalendarWorkspace } from "@/components/domain/home-calendar-workspace";
import { HomeBoardCarousel } from "@/components/domain/home-board-carousel";
import { HomeMetaSection, HomeBuildSection } from "@/components/domain/home-insights";
import type { HomeInsights } from "@/lib/data/home-insights";
import { HomeMatchSwiper } from "@/components/domain/home-match-swiper";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { HomePomSwiper } from "@/components/domain/home-pom-swiper";
import { CelebrationBanner } from "@/components/domain/celebration-banner";
import type { CalendarEvent } from "@/lib/calendar/events";
import type { HomePomEntry } from "@/lib/data/home-pom";
import { teams as themeTeams } from "@/lib/team-themes";
import type { Team } from "@/lib/types";
import type { CommunityPostDetail } from "@/lib/community/types";
import { SectionHeading as Heading } from "@/components/ui/section-heading";
import { AdSlot as Ad } from "@/components/ui/ad-slot";
import { TeamLogo as Logo } from "@/components/ui/team-logo";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";

/* 홈 뉴스/영상 비활성화: 기존 import 보관
import { HomeVideoSwiper } from "@/components/domain/home-video-swiper";
import { HomeNewsSection } from "@/components/news/home-news-section";
import type { HomeVideo } from "@/lib/data/lck-channel-videos";
import type { NewsArticle } from "@/lib/data/news";
*/

type Props = {
  teams: Team[];
  tournamentOverview: Overview;
  tournamentOptions: HomeTournamentOption[];
  matchItems: HomeMatchItem[];
  calendarMonthKey: string;
  calendarTodayKey: string;
  calendarMatches: HomeCalendarMatch[];
  calendarEvents: CalendarEvent[];
  celebrationEvents: CalendarEvent[];
  communityPosts: CommunityPostDetail[];
  communityTitle: "인기글" | "최신글";
  pomEntries: HomePomEntry[];
  // latestVideos: HomeVideo[];
  // newsItems: NewsArticle[];
  insights: HomeInsights | null;
};

const HOME_SECTION_SPACING = "mt-10";

function HeadingSpacer() {
  return (
    <div className="invisible h-11 shrink-0" aria-hidden>
      <Heading>&nbsp;</Heading>
    </div>
  );
}

export function HomeDashboard({
  teams,
  tournamentOverview,
  tournamentOptions,
  matchItems,
  calendarMonthKey,
  calendarMatches,
  calendarEvents,
  celebrationEvents,
  communityPosts,
  communityTitle,
  pomEntries,
  // latestVideos,
  // newsItems,
  insights,
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

      {/* <HomeNewsSection articles={newsItems} /> */}

      <Ad
        enabled={matchItems.length > 0}
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

      <section className={`${HOME_SECTION_SPACING} grid gap-4 xl:grid-cols-3`}>
        <div className="flex min-w-0 flex-col xl:col-span-2">
          <HomeTournamentOverview overview={tournamentOverview} options={tournamentOptions} teams={teams} />
        </div>
        <div className="hidden min-w-0 flex-col xl:flex">
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

      {/* 홈 영상 비활성화: 기존 섹션 보관
      <section className={HOME_SECTION_SPACING}>
        <Heading>최신 영상</Heading>
        <HomeVideoSwiper videos={latestVideos} />
        <Ad
          enabled={matchItems.length > 0}
        placement="horizontal"
          format="auto"
          className="mt-10 h-[100px] md:h-[60px] xl:h-[90px]"
        />
      </section>
      */}

      <div className="mt-6 sm:mt-8 lg:mt-10"><HomeMetaSection data={insights} /></div>
      <HomeBuildSection data={insights} />
      <div>
        <Ad
          enabled={matchItems.length > 0}
        placement="horizontal"
          format="auto"
          className="mt-10 h-[100px] md:h-[60px] xl:h-[90px]"
        />
      </div>
    </main>
  );
}
