import { createHash } from "crypto";

import type { MobileTeamsDto, MobileTeamsPageDto } from "@/packages/contracts/src/mobile-v1";
import { getFanVideoFeed, getPlayers, getTeamInstagramFeed, getTeamsSortedByRank } from "@/lib/data/lck";
import { buildFanVideoItems } from "@/lib/fan-video-items";
import { mobileSuccess, toMobileTeam } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function installationVoterKey(request: Request) {
  const installationId = request.headers.get("x-minion-installation-id")?.trim();
  if (!installationId || installationId.length < 16 || installationId.length > 160) return null;
  return createHash("sha256").update(`mobile:${installationId}`).digest("hex");
}

async function followedTeamIds(request: Request) {
  const auth = await getMobileAuth(request);
  const voterKey = installationVoterKey(request);
  const filters = [auth ? `user_id.eq.${auth.user.id}` : null, voterKey ? `voter_key.eq.${voterKey}` : null]
    .filter((value): value is string => Boolean(value));
  if (!filters.length) return [];

  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("team_fans")
      .select("team_id")
      .or(filters.join(","));
    if (error) throw error;
    return [...new Set((data ?? []).map((row) => row.team_id).filter((id): id is string => typeof id === "string"))];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const selectedKey = params.get("team")?.trim() ?? "";
  const teams = await getTeamsSortedByRank();
  if (params.get("view") !== "explorer") {
    const data: MobileTeamsDto = { items: teams.map(toMobileTeam) };
    return mobileSuccess(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400" } });
  }
  const [players, followedIds] = await Promise.all([getPlayers(), followedTeamIds(request)]);
  const selectedTeam = teams.find((team) => team.fanSiteHost === selectedKey || team.slug === selectedKey) ?? teams[0] ?? null;

  if (!selectedTeam) {
    const data: MobileTeamsPageDto = { followedTeamIds: followedIds, items: [], selected: null };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
  }

  const teamPlayers = players.filter((player) => player.teamId === selectedTeam.id);
  const playerIds = teamPlayers.map((player) => player.id);
  const [instagramFeed, videoFeed] = await Promise.all([
    getTeamInstagramFeed(selectedTeam.id, playerIds),
    getFanVideoFeed(selectedTeam.id, playerIds),
  ]);
  const playersById = new Map(teamPlayers.map((player) => [player.id, player]));
  const social = [
    ...instagramFeed.teamPosts.map((post) => ({
      id: `team-${post.id}`,
      image: post.thumbnailUrl ? { url: post.thumbnailUrl } : null,
      ownerName: selectedTeam.shortName,
      publishedAt: post.publishedAt || null,
      title: post.content || post.title,
      url: post.sourceUrl,
    })),
    ...instagramFeed.playerPosts.map((post) => ({
      id: `player-${post.id}`,
      image: post.imageUrl ? { url: post.imageUrl } : null,
      ownerName: playersById.get(post.playerId)?.name ?? "선수",
      publishedAt: post.postedAt ?? null,
      title: post.caption,
      url: post.sourceUrl,
    })),
  ].sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
  const videos = buildFanVideoItems({
    team: selectedTeam,
    players: teamPlayers,
    playerVideos: videoFeed.playerVideos,
    teamVideos: videoFeed.teamVideos,
  }).map((video) => ({
    channelName: video.ownerName,
    embedUrl: video.embedUrl ?? null,
    id: video.id,
    isNew: video.isNew,
    publishedAt: video.publishedAt || null,
    routeId: video.routeId,
    thumbnail: video.thumbnailUrl ? { url: video.thumbnailUrl } : null,
    title: video.title,
    url: video.videoUrl,
  }));

  const data: MobileTeamsPageDto = {
    followedTeamIds: followedIds,
    items: teams.map(toMobileTeam),
    selected: { social, team: toMobileTeam(selectedTeam), videos },
  };
  return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
}
