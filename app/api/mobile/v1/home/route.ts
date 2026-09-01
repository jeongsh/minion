import { unstable_cache } from "next/cache";

import type { MobileHomeDto } from "@/packages/contracts/src/mobile-v1";
import { getMobileHomePublicData, HOME_PUBLIC_DATA_TAG } from "@/lib/data/home-cache";
import { buildHomePomEntries, getHomePomPlayers, HOME_POM_TAG } from "@/lib/data/home-pom";
import { getLckChannelVideos } from "@/lib/data/lck-channel-videos";
import { getHomeNewsFeed } from "@/lib/data/naver-news";
import { scheduleNewsThumbnailWarmup } from "@/lib/data/news-thumbnail-warmup";
import { getBoardPosts } from "@/lib/data/community";
import {
  COMMUNITY_HOME_HOT_CANDIDATE_LIMIT,
  COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT,
  selectCommunityHomePosts,
} from "@/lib/community/hot";
import { getTodayCelebrations } from "@/lib/calendar/events";
import { isMatchLive } from "@/lib/match-display";
import { mobileSuccess, toMobileMatch, toMobileTeam } from "@/lib/mobile/api-response";
import { buildTeamStandingRows, dateKeyKST } from "@/lib/view-data";

export const revalidate = 30;

async function buildMobileHomeData(): Promise<MobileHomeDto> {
  const [{ teams, matches, tournaments, calendarEvents }, news, videos, popularCommunityPosts, latestCommunityPosts, pomPlayers] = await Promise.all([
    getMobileHomePublicData(),
    getHomeNewsFeed(6),
    getLckChannelVideos(),
    getBoardPosts({ scope: "hub", hotOnly: true, limit: COMMUNITY_HOME_HOT_CANDIDATE_LIMIT }),
    getBoardPosts({ scope: "hub", limit: COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT }),
    getHomePomPlayers(),
  ]);
  scheduleNewsThumbnailWarmup(news.articles);
  const pomEntries = buildHomePomEntries({ matches, players: pomPlayers, teams, tournaments });
  const communityPosts = selectCommunityHomePosts(popularCommunityPosts, latestCommunityPosts);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const tournamentMap = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const byDateAsc = (a: (typeof matches)[number], b: (typeof matches)[number]) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
  const byDateDesc = (a: (typeof matches)[number], b: (typeof matches)[number]) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime();
  const notCompleted = matches.filter((match) => match.status !== "completed").sort(byDateAsc);
  const todayKey = dateKeyKST(new Date());
  let sectionMatches = [
    ...notCompleted.filter(isMatchLive),
    ...notCompleted.filter((match) => !isMatchLive(match)),
    ...matches.filter((match) => match.status === "completed" && dateKeyKST(match.matchDate) === todayKey).sort(byDateDesc),
  ].slice(0, 12);
  if (sectionMatches.length === 0) sectionMatches = matches.filter((match) => match.status === "completed").sort(byDateDesc).slice(0, 6);
  const orderedMatches = sectionMatches.map((match) => toMobileMatch(match, teamMap, tournamentMap));
  const lckTeams = teams.filter((team) => team.isLckTeam);
  const latestSeason = tournaments.length > 0 ? Math.max(...tournaments.map((tournament) => tournament.season)) : new Date().getFullYear();
  const regularSeasonTournamentIds = new Set(tournaments
    .filter((tournament) => tournament.season === latestSeason && (tournament.split === "Rounds 1-2" || /^Rounds 3-\d+$/.test(tournament.split ?? "")))
    .map((tournament) => tournament.id));
  const regularSeasonMatches = matches.filter((match) => regularSeasonTournamentIds.has(match.tournamentId));
  const standingRows = buildTeamStandingRows(lckTeams, regularSeasonMatches, []);
  // 홈 캘린더 컴포넌트가 실제로 사용하는 현재 월 경기만 직렬화한다. 과거/미래
  // 전체 경기 200여 건을 홈 첫 응답에 반복해서 싣지 않는다.
  const currentMonthKey = todayKey.slice(0, 7);
  const calendarByDate = new Map<string, MobileHomeDto["calendar"][number]["matches"]>();
  for (const match of matches) {
    const date = dateKeyKST(match.matchDate);
    if (!date.startsWith(currentMonthKey)) continue;
    const current = calendarByDate.get(date) ?? [];
    current.push(toMobileMatch(match, teamMap, tournamentMap));
    calendarByDate.set(date, current);
  }
  const calendar = [...calendarByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dateMatches]) => ({ date, matches: dateMatches }));
  const data: MobileHomeDto = {
    calendar,
    calendarEvents: calendarEvents.map((event) => ({
      date: event.nextDateKey,
      dday: event.dday,
      id: event.key,
      image: event.playerImageUrl ? { url: event.playerImageUrl } : event.teamLogoUrl ? { url: event.teamLogoUrl } : null,
      isRecurring: event.isRecurring,
      monthDay: event.monthDay,
      title: event.title,
      type: event.type,
    })),
    celebrations: getTodayCelebrations(calendarEvents).map((event) => ({
      id: event.key,
      image: event.playerImageUrl ? { url: event.playerImageUrl } : event.teamLogoUrl ? { url: event.teamLogoUrl } : null,
      subjectName: event.subjectName,
      teamShort: event.teamShort,
      teamSlug: event.teamFanSlug,
      title: event.title,
      type: event.type,
      yearsCount: event.yearsCount,
    })),
    community: communityPosts.map((post) => ({
      author: {
        favoriteTeam: post.authorTeam ? {
          id: post.authorTeam.id,
          name: post.authorTeam.name,
          primaryColor: post.authorTeam.primaryColor,
          shortName: post.authorTeam.shortName,
          slug: post.authorTeam.slug,
        } : null,
        guestIpLabel: post.guestIpLabel,
        id: post.authorId,
        nickname: post.authorName,
        profileImage: post.authorImageUrl ? { url: post.authorImageUrl } : null,
        tier: post.authorTier,
      },
      boardType: post.boardType,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      dislikeCount: post.dislikeCount,
      excerpt: post.excerpt,
      id: post.id,
      isBlinded: Boolean(post.blindedAt),
      isHot: Boolean(post.hotAt),
      isNotice: post.isNotice,
      likeCount: post.likeCount,
      scope: "hub",
      teamId: post.teamId,
      thumbnail: post.thumbnailUrl ? { url: post.thumbnailUrl } : null,
      title: post.title,
      viewCount: post.viewCount,
    })),
    matches: orderedMatches,
    news: news.articles.map((article) => ({
      id: article.id,
      publishedAt: article.publishedAt,
      source: article.source,
      thumbnail: article.thumbnailUrl ? { url: article.thumbnailUrl } : null,
      title: article.title,
      url: article.url,
    })),
    standings: standingRows.slice(0, 10).map((row) => ({ losses: row.matchLosses, rank: row.rank, setDiff: row.setDiff, teamId: row.team.id, wins: row.matchWins })),
    teams: lckTeams.map(toMobileTeam),
    pom: pomEntries.map((entry) => ({
      matchId: entry.matchId,
      opponentShortName: entry.opponentShortName,
      playerImage: entry.playerImageUrl ? { url: entry.playerImageUrl } : null,
      playerName: entry.playerName,
      playerSlug: entry.playerSlug,
      position: entry.position,
      scoreLabel: entry.scoreLabel,
      teamLogo: entry.teamLogoUrl ? { url: entry.teamLogoUrl } : null,
      teamPrimaryColor: entry.teamPrimaryColor,
      teamShortName: entry.teamShortName,
      tournamentName: entry.tournamentName,
    })),
    videos: videos.slice(0, 12).map((video) => ({ channelName: video.channelName, id: video.id, publishedAt: video.publishedAt, thumbnail: { url: video.thumbnailUrl }, title: video.title, url: video.videoUrl })),
  };
  return data;
}

const getMobileHomeData = unstable_cache(
  buildMobileHomeData,
  ["mobile-home-v1-response"],
  { revalidate: 30, tags: [HOME_PUBLIC_DATA_TAG, HOME_POM_TAG] },
);

export async function GET() {
  const data = await getMobileHomeData();
  return mobileSuccess(data, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
