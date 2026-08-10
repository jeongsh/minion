import { HomeDashboard, type HomeStandingRow } from "@/components/domain/home-dashboard";
import type { HomeCalendarMatch } from "@/components/domain/home-calendar";
import type { HomeMatchItem } from "@/components/domain/home-match-card";
import { getHomePagePublicData } from "@/lib/data/home-cache";
import { getHomePomEntries } from "@/lib/data/home-pom";
import type { Match } from "@/lib/types";
import { getBoardPosts } from "@/lib/data/community";
import { buildTeamStandingRows, dateKeyKST, formatTimeKST, matchHref } from "@/lib/view-data";
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
  const { teams, matches, tournaments, latestVideos, calendarEvents } = homeData;

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

  // 홈 게시판 캐러셀: 디자인 확인을 위해 최신글을 임시로 노출한다.
  // getBoardPosts가 최신순으로 반환하며, 블라인드/공지 글은 홈에서 제외한다.
  const homeEligiblePosts = communityPosts.filter((post) => !post.blindedAt && !post.isNotice);
  const homeCommunityPosts = homeEligiblePosts.slice(0, 12);

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
