import type { MobileTeamDetailDto } from "@/packages/contracts/src/mobile-v1";
import { getFanVideoFeed, getPlayersByTeamId, getTeamByFanSiteHost, getTeamBySlug, getTeamInstagramFeed } from "@/lib/data/lck";
import { mobileError, mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";

export const revalidate = 300;

export async function GET(_: Request, context: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await context.params;
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
  const players = await getPlayersByTeamId(team.id);
  const playerIds = players.map((player) => player.id);
  const [socialFeed, videoFeed] = await Promise.all([
    getTeamInstagramFeed(team.id, playerIds),
    getFanVideoFeed(team.id, playerIds),
  ]);
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const data: MobileTeamDetailDto = {
    players: players.map((player) => ({ id: player.id, name: player.name, position: player.position, profileImage: player.profileImageUrl ? { url: player.profileImageUrl } : null, slug: player.slug, teamId: player.teamId })),
    social: [
      ...socialFeed.teamPosts.map((post) => ({ id: `team-${post.id}`, image: post.thumbnailUrl ? { url: post.thumbnailUrl } : null, ownerName: team.shortName, publishedAt: post.publishedAt || null, title: post.content || post.title, url: post.sourceUrl })),
      ...socialFeed.playerPosts.map((post) => ({ id: `player-${post.id}`, image: post.imageUrl ? { url: post.imageUrl } : null, ownerName: playerMap.get(post.playerId)?.name ?? "선수", publishedAt: post.postedAt ?? null, title: post.caption, url: post.sourceUrl })),
    ].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, 20),
    team: toMobileTeam(team),
    videos: [
      ...videoFeed.teamVideos.map((video) => ({ channelName: team.shortName, id: `team-${video.id}`, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })),
      ...videoFeed.playerVideos.map((video) => ({ channelName: playerMap.get(video.playerId)?.name ?? team.shortName, id: `player-${video.id}`, publishedAt: video.publishedAt || null, thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null, title: video.title, url: video.videoUrl })),
    ].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()).slice(0, 20),
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900" } });
}
