import type { Metadata } from "next";
import { getStages, getBracketStages } from "@/lib/data/lck";
import { buildHomeTournamentOverview } from "@/lib/tournaments/home-overview";
import { ALL_SEGMENTS } from "@/lib/tournaments/segment-nav";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";

import { HomeDashboard } from "@/components/domain/home-dashboard";
import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { getMobileHomePublicData } from "@/lib/data/home-cache";
import { buildHomePomEntries, getHomePomPlayers } from "@/lib/data/home-pom";
import type { Match } from "@/lib/types";
import { getBoardPosts } from "@/lib/data/community";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { isMatchLive } from "@/lib/match-display";
import { getPredictionMarketData } from "@/lib/predictions";
import { getTodayCelebrations } from "@/lib/calendar/events";
import { getHomeInsights } from "@/lib/data/home-insights";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeOnboardingNext } from "@/lib/auth/onboarding";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import {
  COMMUNITY_HOME_HOT_CANDIDATE_LIMIT,
  COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT,
  communityHomeSectionTitle,
  selectCommunityHomePosts,
} from "@/lib/community/hot";

/* 홈 뉴스/영상 비활성화: 기존 import 보관
import { getHomePagePublicData } from "@/lib/data/home-cache";
import { getLckChannelVideos, type HomeVideo } from "@/lib/data/lck-channel-videos";
import { getHomeNewsFeed } from "@/lib/data/naver-news";
import { scheduleNewsThumbnailWarmup } from "@/lib/data/news-thumbnail-warmup";
*/

export const dynamic = "force-dynamic";

// title/description/OG는 루트 레이아웃 기본값이 곧 홈 콘텐츠라 그대로 두고, canonical만 고정해
// 쿼리스트링이 붙은 변형 URL이 별도 색인되지 않도록 한다.
export const metadata: Metadata = { alternates: { canonical: "/" } };

function yearMonthKeyKST(value: string) {
  return dateKeyKST(value).slice(0, 7);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const onboardingMode = Array.isArray(params.onboarding) ? params.onboarding[0] : params.onboarding;
  const showOnboarding = onboardingMode === "1" || onboardingMode === "debug";
  const forceOnboarding = onboardingMode === "debug";
  const onboardingNext = safeOnboardingNext(params.next);
  const [homeData, popularCommunityPosts, latestCommunityPosts, predictionMarket, pomPlayers, insights, stages, bracketStages] = await Promise.all([
    getMobileHomePublicData(),
    getBoardPosts({ scope: "hub", hotOnly: true, limit: COMMUNITY_HOME_HOT_CANDIDATE_LIMIT }),
    getBoardPosts({ scope: "hub", limit: COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT }),
    getPredictionMarketData(),
    getHomePomPlayers(),
    getHomeInsights().catch((error) => {
      console.error("Home insights unavailable", error);
      return null;
    }),
    getStages(),
    getBracketStages(),
  ]);
  const { teams, matches, tournaments, calendarEvents } = homeData;
  const pomEntries = buildHomePomEntries({ matches, players: pomPlayers, teams, tournaments });

  // 오늘의 기념일. 배너를 누르면 해당 팀 게시판으로 이동한다.
  const todayCelebrations = getTodayCelebrations(calendarEvents);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const tournamentOverview = buildHomeTournamentOverview({ teams, matches, tournaments, stages, bracketStages });
  const overviewSeason = Number(tournamentOverview?.name.slice(0, 4)) || new Date().getFullYear();
  const tournamentOptions = ALL_SEGMENTS.flatMap((segment) => {
    const selectedTournaments = tournaments.filter((tournament) => tournament.season === overviewSeason && matchesTournamentSegment(tournament, segment.key));
    if (selectedTournaments.length === 0) return [];
    return [{ key: segment.key, label: segment.name, name: `${overviewSeason} ${segment.name}`, overview: buildHomeTournamentOverview({ teams, matches, tournaments: selectedTournaments, stages, bracketStages }) }];
  });

  const todayKey = dateKeyKST(new Date());
  const byDateAsc = (a: Match, b: Match) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
  const byDateDesc = (a: Match, b: Match) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime();

  // 홈 매치 섹션. 예전에는 "오늘의 매치"와 "다가오는 매치"를 따로 뽑았는데, 오늘 예정
  // 경기가 양쪽 조건에 모두 걸려 같은 경기가 한 화면에 두 번 나왔다. 하나로 합치고
  // LIVE → 예정(시간순) → 오늘 끝난 경기(최신순) 순으로 늘어놓는다.
  // 세 묶음은 서로 겹치지 않으므로 별도 중복 제거가 필요 없다.
  const notCompleted = matches.filter((match) => match.status !== "completed").sort(byDateAsc);
  const liveMatches = notCompleted.filter((match) => isMatchLive(match));
  const scheduledMatches = notCompleted.filter((match) => !isMatchLive(match));
  const todayFinished = matches
    .filter((match) => match.status === "completed" && dateKeyKST(match.matchDate) === todayKey)
    .sort(byDateDesc);

  let sectionMatches = [...liveMatches, ...scheduledMatches, ...todayFinished].slice(0, 12);
  // 시즌 사이처럼 예정 경기도 오늘 경기도 없는 기간에는 섹션이 통째로 비어버리므로,
  // 가장 최근에 끝난 경기들로 대신 채운다.
  if (sectionMatches.length === 0) {
    sectionMatches = matches.filter((match) => match.status === "completed").sort(byDateDesc).slice(0, 6);
  }

  const predictionBetsByMatchId = new Map<string, typeof predictionMarket.bets>();
  for (const bet of predictionMarket.bets) {
    predictionBetsByMatchId.set(bet.matchId, [...(predictionBetsByMatchId.get(bet.matchId) ?? []), bet]);
  }
  const tournamentNamesById = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));
  const tournamentLeagueById = new Map(tournaments.map((tournament) => [tournament.id, tournament.league ?? ""]));

  const matchItems: HomeMatchItem[] = sectionMatches.map((match) => ({
    match,
    teamA: teamsById.get(match.teamAId),
    teamB: teamsById.get(match.teamBId),
    tournament: tournamentNamesById.get(match.tournamentId),
    bets: predictionBetsByMatchId.get(match.id) ?? [],
  }));

  const calendarMonthKey = todayKey.slice(0, 7);
  const calendarMatches = matches
    .filter((match) => yearMonthKeyKST(match.matchDate) === calendarMonthKey)
    .sort(byDateAsc);
  const calendarClientMatches: HomeCalendarMatch[] = calendarMatches.map((match) => {
    const teamA = teamsById.get(match.teamAId);
    const teamB = teamsById.get(match.teamBId);

    return {
      id: match.id,
      dateKey: dateKeyKST(match.matchDate),
      href: matchHref(match),
      time: formatTimeKST(match.matchDate),
      league: tournamentLeagueById.get(match.tournamentId) || "",
      teamAName: teamA?.shortName ?? "TBD",
      teamBName: teamB?.shortName ?? "TBD",
      teamALogoUrl: teamA?.logoUrl ?? null,
      teamBLogoUrl: teamB?.logoUrl ?? null,
    };
  });
  /* 홈 뉴스/영상 비활성화: 기존 데이터 처리 보관
  // 기존 뉴스/영상 데이터 로딩 (복원 시 Promise.all 결과와 호출을 함께 추가)
  const homeData = await getHomePagePublicData();
  const lckChannelVideos = await getLckChannelVideos();
  const homeNewsFeed = await getHomeNewsFeed(6);
  scheduleNewsThumbnailWarmup(homeNewsFeed.articles);
  const { latestVideos } = homeData;
  // 최신 영상: 팀/선수 채널 영상과 LCK 공식 채널 영상을 최신순으로 섞어 12개만 노출한다.
  const teamVideoItems: HomeVideo[] = latestVideos.map((video) => ({
    id: video.id,
    title: video.title,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    channelName: teamsById.get(video.teamId)?.shortName ?? "LCK",
  }));
  // 팀 영상이 LCK 공식 영상보다 자주 올라와 날짜순으로만 섞으면 공식 영상이 모두 밀려난다.
  // 양쪽에 절반씩 자리를 보장한 뒤(한쪽이 모자라면 다른 쪽이 채운다) 그 안에서 최신순으로 정렬한다.
  const byNewest = (a: HomeVideo, b: HomeVideo) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  const HOME_VIDEO_LIMIT = 12;
  const sortedTeamVideos = [...teamVideoItems].sort(byNewest);
  const sortedLckVideos = [...lckChannelVideos].sort(byNewest);
  const lckQuota = Math.min(sortedLckVideos.length, Math.max(HOME_VIDEO_LIMIT / 2, HOME_VIDEO_LIMIT - sortedTeamVideos.length));
  const homeVideos = [
    ...sortedLckVideos.slice(0, lckQuota),
    ...sortedTeamVideos.slice(0, HOME_VIDEO_LIMIT - lckQuota),
  ].sort(byNewest);

  */

  // 인기글을 우선 노출하고, 6개에 못 미치면 중복 없이 최신글로 채운다.
  const homeCommunityPosts = selectCommunityHomePosts(popularCommunityPosts, latestCommunityPosts);
  const homeCommunityTitle = communityHomeSectionTitle(homeCommunityPosts);

  let onboarding: React.ReactNode = null;
  if (showOnboarding) {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createSupabaseAuthClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, profile_image_url, onboarding_completed_at")
        .eq("id", user.id)
        .maybeSingle();
      if (forceOnboarding || !profile?.onboarding_completed_at) {
        const initialNickname = forceOnboarding || !profile?.onboarding_completed_at
          ? ""
          : profile.nickname ?? "";
        onboarding = (
          <OnboardingDialog
            initialNickname={initialNickname}
            initialProfileImageUrl={profile?.profile_image_url ?? null}
            teams={teams.filter((team) => team.isLckTeam)}
            next={onboardingNext}
          />
        );
      }
    }
  }

  return (
    <>
      <HomeDashboard
      teams={teams}
      tournamentOverview={tournamentOverview}
      tournamentOptions={tournamentOptions}
      matchItems={matchItems}
      calendarMonthKey={calendarMonthKey}
      calendarTodayKey={todayKey}
      calendarMatches={calendarClientMatches}
      calendarEvents={calendarEvents}
      celebrationEvents={todayCelebrations}
      communityPosts={homeCommunityPosts}
      communityTitle={homeCommunityTitle}
      pomEntries={pomEntries}
      /* 기존 뉴스/영상 props
      latestVideos={homeVideos}
      newsItems={homeNewsFeed.articles}
      */
      insights={insights}
      />
      {onboarding}
    </>
  );
}
