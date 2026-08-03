import { HomeDashboard, type HomeStandingRow } from "@/components/domain/home-dashboard";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { getHomePagePublicData } from "@/lib/data/home-cache";
import { getHomePomEntries } from "@/lib/data/home-pom";
import type { Match } from "@/lib/types";
import { getBoardPosts } from "@/lib/data/community";
import { compareHotPostsByRecentHype, isHotPost } from "@/lib/community/hot";
import { dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
import { isMatchLive } from "@/lib/match-display";
import { getPredictionMarketData } from "@/lib/predictions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTodayCelebrations } from "@/lib/calendar/events";
import { getWeeklyReportIndex } from "@/lib/reports/queries";
import { getLckChannelVideos, type HomeVideo } from "@/lib/data/lck-channel-videos";
import { getHomeNewsFeed } from "@/lib/data/naver-news";

export const dynamic = "force-dynamic";

function yearMonthKeyKST(value: string) {
  return dateKeyKST(value).slice(0, 7);
}

function buildRecentForm(teamId: string, matches: Match[]) {
  return matches
    .filter((match) => match.status === "completed" && (match.teamAId === teamId || match.teamBId === teamId))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(0, 5)
    .map((match) => (match.winnerTeamId === teamId ? "W" : "L") as "W" | "L");
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const [homeData, communityPosts, predictionMarket, lckChannelVideos, pomEntries, reportIndex, homeNewsFeed] = await Promise.all([
    getHomePagePublicData(),
    getBoardPosts({ scope: "hub" }),
    getPredictionMarketData(user?.id),
    getLckChannelVideos(),
    getHomePomEntries(),
    getWeeklyReportIndex(),
    getHomeNewsFeed(6),
  ]);
  const { teams, matches, savedStandings, tournaments, latestVideos, calendarEvents } = homeData;

  // 오늘의 기념일. 배너를 누르면 해당 팀 게시판으로 이동한다.
  const todayCelebrations = getTodayCelebrations(calendarEvents);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const latestSeason = tournaments.length > 0 ? Math.max(...tournaments.map((tournament) => tournament.season)) : 2026;
  const latestTournamentIds = new Set(
    tournaments.filter((tournament) => tournament.season === latestSeason).map((tournament) => tournament.id),
  );
  const standingRows = savedStandings
    .filter((standing) => latestTournamentIds.has(standing.tournamentId))
    .map((standing) => {
      const team = teamsById.get(standing.teamId);
      if (!team) return null;

      return {
        team,
        teamId: standing.teamId,
        rank: standing.rank,
        wins: standing.wins,
        losses: standing.losses,
        setDiff: standing.setDiff,
        recent: buildRecentForm(standing.teamId, matches),
      };
    })
    .filter((row): row is HomeStandingRow => row !== null)
    .sort((a, b) => a.rank - b.rank);

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

  // 홈 게시판 캐러셀: 인기글만 랭킹 순으로 노출한다.
  // 블라인드/공지 글은 홈에 노출하지 않는다.
  const homeEligiblePosts = communityPosts.filter((post) => !post.blindedAt && !post.isNotice);
  const homeCommunityPosts = homeEligiblePosts.filter(isHotPost).sort(compareHotPostsByRecentHype).slice(0, 12);

  return (
    <HomeDashboard
      teams={teams}
      standingRows={standingRows}
      matchItems={matchItems}
      currentUserId={user?.id}
      predictionBalance={predictionMarket.balance}
      calendarMonthKey={calendarMonthKey}
      calendarTodayKey={todayKey}
      calendarMatches={calendarClientMatches}
      calendarEvents={calendarEvents}
      celebrationEvents={todayCelebrations}
      latestVideos={homeVideos}
      communityPosts={homeCommunityPosts}
      pomEntries={pomEntries}
      latestReport={reportIndex[0] ?? null}
      newsItems={homeNewsFeed.articles}
    />
  );
}
