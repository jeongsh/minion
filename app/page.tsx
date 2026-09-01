import { HomeDashboard, type HomeStandingRow } from "@/components/domain/home-dashboard";
import { OnboardingDialog } from "@/components/auth/onboarding-dialog";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { getHomePagePublicData } from "@/lib/data/home-cache";
import { buildHomePomEntries, getHomePomPlayers } from "@/lib/data/home-pom";
import type { Match } from "@/lib/types";
import { getBoardPosts } from "@/lib/data/community";
import { buildTeamStandingRows, dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { isMatchLive } from "@/lib/match-display";
import { getPredictionMarketData } from "@/lib/predictions";
import { getTodayCelebrations } from "@/lib/calendar/events";
import { getLckChannelVideos, type HomeVideo } from "@/lib/data/lck-channel-videos";
import { getHomeNewsFeed } from "@/lib/data/naver-news";
import { scheduleNewsThumbnailWarmup } from "@/lib/data/news-thumbnail-warmup";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeOnboardingNext } from "@/lib/auth/onboarding";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-server";
import {
  COMMUNITY_HOME_HOT_CANDIDATE_LIMIT,
  COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT,
  communityHomeSectionTitle,
  selectCommunityHomePosts,
} from "@/lib/community/hot";

export const dynamic = "force-dynamic";

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
  const [homeData, popularCommunityPosts, latestCommunityPosts, predictionMarket, lckChannelVideos, pomPlayers, homeNewsFeed] = await Promise.all([
    getHomePagePublicData(),
    getBoardPosts({ scope: "hub", hotOnly: true, limit: COMMUNITY_HOME_HOT_CANDIDATE_LIMIT }),
    getBoardPosts({ scope: "hub", limit: COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT }),
    getPredictionMarketData(),
    getLckChannelVideos(),
    getHomePomPlayers(),
    getHomeNewsFeed(6),
  ]);
  scheduleNewsThumbnailWarmup(homeNewsFeed.articles);
  const { teams, matches, tournaments, latestVideos, calendarEvents } = homeData;
  const pomEntries = buildHomePomEntries({ matches, players: pomPlayers, teams, tournaments });

  // 오늘의 기념일. 배너를 누르면 해당 팀 게시판으로 이동한다.
  const todayCelebrations = getTodayCelebrations(calendarEvents);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latestSeason = tournaments.length > 0 ? Math.max(...tournaments.map((tournament) => tournament.season)) : 2026;
  // "실시간 순위"는 DB 스냅샷 테이블이 아니라 /tournaments 페이지와 동일하게 정규시즌
  // (Rounds 1-2 + Rounds 3-4/5) 경기 결과에서 매번 계산한다. 스냅샷은 수동 갱신이 필요해
  // 시즌이 진행될수록 실제 순위와 어긋나기 때문이다.
  const regularSeasonTournamentIds = new Set(
    tournaments
      .filter((tournament) => tournament.season === latestSeason
        && (tournament.split === "Rounds 1-2" || /^Rounds 3-\d+$/.test(tournament.split ?? "")))
      .map((tournament) => tournament.id),
  );
  const regularSeasonMatches = matches.filter((match) => regularSeasonTournamentIds.has(match.tournamentId));
  const lckTeams = teams.filter((team) => team.isLckTeam);
  const standingRows: HomeStandingRow[] = buildTeamStandingRows(lckTeams, regularSeasonMatches, []).map((row) => ({
    team: row.team,
    teamId: row.team.id,
    rank: row.rank,
    wins: row.matchWins,
    losses: row.matchLosses,
    setDiff: row.setDiff,
  }));

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
      standingRows={standingRows}
      matchItems={matchItems}
      calendarMonthKey={calendarMonthKey}
      calendarTodayKey={todayKey}
      calendarMatches={calendarClientMatches}
      calendarEvents={calendarEvents}
      celebrationEvents={todayCelebrations}
      latestVideos={homeVideos}
      communityPosts={homeCommunityPosts}
      communityTitle={homeCommunityTitle}
      pomEntries={pomEntries}
      newsItems={homeNewsFeed.articles}
      />
      {onboarding}
    </>
  );
}
