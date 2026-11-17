import { getMediaPage, getMediaTabs, type MediaCursor } from "@/lib/fan/media-feed";
import type { MobileTeamDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getFanVideoFeed, getMatchesForScope, getFanHomeMatches, getPlayersByTeamId, getTeamByFanSiteHost, getTeamBySlug, getTeamInstagramFeed, getTournaments } from "@/lib/data/lck";
import { getBoardPosts } from "@/lib/data/community";
import {
  COMMUNITY_HOME_HOT_CANDIDATE_LIMIT,
  COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT,
  selectCommunityHomePosts,
} from "@/lib/community/hot";
import { getActiveFanHeaderUrl } from "@/lib/fan/fan-header";
import { getCalendarPageData } from "@/lib/calendar/page-data";
import { mobileCalendarEvents } from "@/lib/mobile/team-calendar";
import { mobileError, mobileSuccess, toMobileMatch, toMobileTeam } from "@/lib/mobile/api-response";
import { toMobileCommunityPost } from "@/lib/mobile/community";

export const revalidate = 60;

export async function GET(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await context.params;
  const query = new URL(request.url).searchParams;
  const section = query.get("section");
  const paged = query.get("view") === "paged";
  const isMedia = section === "social" || section === "videos";
  let cursor: MediaCursor = { team: 0, player: 0 };
  if (paged && query.get("cursor")) {
    try { cursor = JSON.parse(query.get("cursor")!); } catch { return mobileError("BAD_REQUEST", "목록 위치를 확인해 주세요.", 400); }
    if (!cursor || ![cursor.team, cursor.player].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 2_000_000_000)) return mobileError("BAD_REQUEST", "목록 위치를 확인해 주세요.", 400);
  }
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
  const players = await getPlayersByTeamId(team.id);
  const playerIds = players.map((player) => player.id);
  const [socialFeed, videoFeed, activeHeaderImage, matches, teams, tournaments, calendarData, popularBoardPosts, latestBoardPosts] = await Promise.all([
    !paged || section === "home" ? getTeamInstagramFeed(team.id, playerIds, paged ? 12 : undefined) : Promise.resolve({ teamPosts: [], playerPosts: [] }),
    !paged || section === "home" ? getFanVideoFeed(team.id, playerIds, paged ? 12 : undefined) : Promise.resolve({ teamVideos: [], playerVideos: [] }),
    getActiveFanHeaderUrl(team.id),
    !paged ? getMatchesForScope({ teamIds: [team.id] }) : section === "home" ? getFanHomeMatches(team.id) : Promise.resolve([]),
    getAllTeams(),
    getTournaments(),
    section === "home" || section === "schedule"
      ? getCalendarPageData(query.get("month"), team.id)
      : Promise.resolve(null),
    section === "home"
      ? getBoardPosts({ scope: "team", teamId: team.id, hotOnly: true, limit: COMMUNITY_HOME_HOT_CANDIDATE_LIMIT })
      : Promise.resolve([]),
    section === "home"
      ? getBoardPosts({ scope: "team", teamId: team.id, limit: COMMUNITY_HOME_LATEST_CANDIDATE_LIMIT })
      : Promise.resolve([]),
  ]);
  const kind = section === "social" ? "instagram" : "videos";
  let mediaPage;
  let mediaTabs;
  if (paged && isMedia) {
    const owner = query.get("owner") ?? "all";
    mediaTabs = await getMediaTabs(teamSlug, kind);
    if (!mediaTabs.some(tab => tab.key === owner)) return mobileError("BAD_REQUEST", "필터를 확인해 주세요.", 400);
    mediaPage = await getMediaPage(teamSlug, kind, owner, cursor, section === "social" ? 15 : 12);
    socialFeed.teamPosts = mediaPage.teamPosts;
    socialFeed.playerPosts = mediaPage.playerPosts;
  }
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const teamMap = new Map(teams.map((item) => [item.id, item]));
  const tournamentMap = new Map(tournaments.map((item) => [item.id, item]));
  const data: MobileTeamDetailDto = {
    ...(mediaPage ? { media: { tabs: mediaTabs!, nextCursor: mediaPage.next ? JSON.stringify(mediaPage.next) : null } } : {}),
    calendarEvents: mobileCalendarEvents(calendarData?.events ?? []),
    headerImage: activeHeaderImage
      ? { url: activeHeaderImage }
      : team.fanSiteHost === "hle"
        ? { url: "/images/fan-headers/hle-header-bg-v1.jpg" }
        : null,
    community: selectCommunityHomePosts(popularBoardPosts, latestBoardPosts)
      .map(toMobileCommunityPost),
    matches: (paged && section === "schedule" ? calendarData?.matches ?? [] : matches)
      .filter((match) => match.teamAId === team.id || match.teamBId === team.id)
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
      .map((match) => toMobileMatch(match, teamMap, tournamentMap)),
    players: players.map((player) => ({
      id: player.id,
      isStarter: player.isStarter,
      name: player.name,
      position: player.position,
      profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null,
      realName: player.realName,
      slug: player.slug,
      teamId: player.teamId,
    })),
    social: [
      ...socialFeed.teamPosts.map((post) => ({ id: `team-${post.id}`, image: post.thumbnailUrl ? { url: post.thumbnailUrl } : null, ownerName: team.shortName, publishedAt: post.publishedAt || null, title: post.content || post.title, url: post.sourceUrl })),
      ...socialFeed.playerPosts.map((post) => ({ id: `player-${post.id}`, image: post.imageUrl ? { url: post.imageUrl } : null, ownerName: playerMap.get(post.playerId)?.name ?? "선수", publishedAt: post.postedAt ?? null, title: post.caption, url: post.sourceUrl })),
    ].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, section === "social" ? Number.POSITIVE_INFINITY : 12),
    team: toMobileTeam(team),
    videos: mediaPage ? mediaPage.videos.map(video => ({ channelName: video.ownerName, id: video.id, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })) : [
      ...videoFeed.teamVideos.map((video) => ({ channelName: team.shortName, id: `team-${video.id}`, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })),
      ...videoFeed.playerVideos.map((video) => ({ channelName: playerMap.get(video.playerId)?.name ?? team.shortName, id: `player-${video.id}`, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })),
    ].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, section === "videos" ? Number.POSITIVE_INFINITY : 12),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
