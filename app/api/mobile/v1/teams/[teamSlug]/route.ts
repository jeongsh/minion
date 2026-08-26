import type { MobileTeamDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getAllTeams, getFanVideoFeed, getMatches, getPlayersByTeamId, getTeamByFanSiteHost, getTeamBySlug, getTeamInstagramFeed, getTournaments } from "@/lib/data/lck";
import { getBoardPosts } from "@/lib/data/community";
import { compareHotPostsByRecentHype, isHotPost } from "@/lib/community/hot";
import { getActiveFanHeaderUrl } from "@/lib/fan/fan-header";
import { getCalendarEvents } from "@/lib/calendar/events";
import { mobileError, mobileSuccess, toMobileMatch, toMobileTeam } from "@/lib/mobile/api-response";
import { toMobileCommunityPost } from "@/lib/mobile/community";

export const revalidate = 60;

export async function GET(request: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await context.params;
  const section = new URL(request.url).searchParams.get("section");
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
  const players = await getPlayersByTeamId(team.id);
  const playerIds = players.map((player) => player.id);
  const [socialFeed, videoFeed, activeHeaderImage, matches, teams, tournaments, calendarEvents, boardPosts] = await Promise.all([
    getTeamInstagramFeed(team.id, playerIds),
    getFanVideoFeed(team.id, playerIds),
    getActiveFanHeaderUrl(team.id),
    getMatches(),
    getAllTeams(),
    getTournaments(),
    section === "home" || section === "schedule"
      ? getCalendarEvents({ teamId: team.id, includePastOneTime: section === "schedule" })
      : Promise.resolve([]),
    section === "home"
      ? getBoardPosts({ scope: "team", teamId: team.id, hotOnly: true, limit: 30 })
      : Promise.resolve([]),
  ]);
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const teamMap = new Map(teams.map((item) => [item.id, item]));
  const tournamentMap = new Map(tournaments.map((item) => [item.id, item]));
  const data: MobileTeamDetailDto = {
    calendarEvents: calendarEvents.map((event) => ({
      date: event.nextDateKey,
      dday: event.dday,
      id: event.key,
      image: event.playerImageUrl ? { url: event.playerImageUrl } : event.teamLogoUrl ? { url: event.teamLogoUrl } : null,
      isRecurring: event.isRecurring,
      monthDay: event.monthDay,
      title: event.title,
      type: event.type,
      eventTime: event.eventTime,
      sourceUrl: event.sourceUrl,
    })),
    headerImage: activeHeaderImage
      ? { url: activeHeaderImage }
      : team.fanSiteHost === "hle"
        ? { url: "/images/fan-headers/hle-header-bg-v1.jpg" }
        : null,
    community: boardPosts
      .filter((post) => !post.blindedAt && !post.isNotice && isHotPost(post))
      .sort(compareHotPostsByRecentHype)
      .slice(0, 12)
      .map(toMobileCommunityPost),
    matches: matches
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
    videos: [
      ...videoFeed.teamVideos.map((video) => ({ channelName: team.shortName, id: `team-${video.id}`, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })),
      ...videoFeed.playerVideos.map((video) => ({ channelName: playerMap.get(video.playerId)?.name ?? team.shortName, id: `player-${video.id}`, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })),
    ].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, section === "videos" ? Number.POSITIVE_INFINITY : 12),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
