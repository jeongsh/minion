import type { SupabaseClient } from "@supabase/supabase-js";

import type { YoutubeFeedEntry } from "../youtube-feed.ts";
import { resolveYoutubeChannelId } from "../youtube-feed.ts";
import { youtubeEmbedUrl, youtubeWatchUrl } from "../youtube.ts";

export type YoutubeVideoOwner =
  | {
      kind: "team";
      id: string;
      name: string;
      teamId: string;
      youtubeUrl: string | null;
      youtubeChannelId: string | null;
    }
  | {
      kind: "player";
      id: string;
      name: string;
      teamId: string | null;
      youtubeUrl: string | null;
      youtubeChannelId: string | null;
    };

export async function getYoutubeVideoOwners(supabase: SupabaseClient): Promise<YoutubeVideoOwner[]> {
  const [teamsResult, playersResult] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name, official_youtube_url, official_youtube_channel_id")
      .not("official_youtube_url", "is", null),
    supabase
      .from("players")
      .select("id, name, team_id, youtube_url, youtube_channel_id")
      .not("youtube_url", "is", null)
      .not("team_id", "is", null),
  ]);

  if (teamsResult.error) throw teamsResult.error;
  if (playersResult.error) throw playersResult.error;

  return [
    ...((teamsResult.data ?? []) as Array<{
      id: string;
      name: string;
      short_name: string | null;
      official_youtube_url: string | null;
      official_youtube_channel_id: string | null;
    }>).map((team) => ({
      kind: "team" as const,
      id: team.id,
      name: team.short_name ?? team.name,
      teamId: team.id,
      youtubeUrl: team.official_youtube_url,
      youtubeChannelId: team.official_youtube_channel_id,
    })),
    ...((playersResult.data ?? []) as Array<{
      id: string;
      name: string;
      team_id: string | null;
      youtube_url: string | null;
      youtube_channel_id: string | null;
    }>).map((player) => ({
      kind: "player" as const,
      id: player.id,
      name: player.name,
      teamId: player.team_id,
      youtubeUrl: player.youtube_url,
      youtubeChannelId: player.youtube_channel_id,
    })),
  ];
}

export async function saveYoutubeChannelId(
  supabase: SupabaseClient,
  owner: YoutubeVideoOwner,
  channelId: string,
) {
  if (owner.youtubeChannelId === channelId) return;

  const table = owner.kind === "team" ? "teams" : "players";
  const column = owner.kind === "team" ? "official_youtube_channel_id" : "youtube_channel_id";
  const { error } = await supabase.from(table).update({ [column]: channelId }).eq("id", owner.id);
  if (error) throw error;
}

export async function resolveOwnerChannelId(supabase: SupabaseClient, owner: YoutubeVideoOwner) {
  if (owner.youtubeChannelId) return owner.youtubeChannelId;
  if (!owner.youtubeUrl) return null;

  const channelId = await resolveYoutubeChannelId(owner.youtubeUrl);
  if (channelId) {
    await saveYoutubeChannelId(supabase, owner, channelId);
  }

  return channelId;
}

export async function findYoutubeOwnerByChannelId(
  supabase: SupabaseClient,
  channelId: string,
): Promise<YoutubeVideoOwner | null> {
  const [teamResult, playerResult] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, short_name, official_youtube_url, official_youtube_channel_id")
      .eq("official_youtube_channel_id", channelId)
      .maybeSingle(),
    supabase
      .from("players")
      .select("id, name, team_id, youtube_url, youtube_channel_id")
      .eq("youtube_channel_id", channelId)
      .maybeSingle(),
  ]);

  if (teamResult.error) throw teamResult.error;
  if (playerResult.error) throw playerResult.error;

  const team = teamResult.data as
    | {
        id: string;
        name: string;
        short_name: string | null;
        official_youtube_url: string | null;
        official_youtube_channel_id: string | null;
      }
    | null;
  if (team) {
    return {
      kind: "team",
      id: team.id,
      name: team.short_name ?? team.name,
      teamId: team.id,
      youtubeUrl: team.official_youtube_url,
      youtubeChannelId: team.official_youtube_channel_id,
    };
  }

  const player = playerResult.data as
    | {
        id: string;
        name: string;
        team_id: string | null;
        youtube_url: string | null;
        youtube_channel_id: string | null;
      }
    | null;
  if (player) {
    return {
      kind: "player",
      id: player.id,
      name: player.name,
      teamId: player.team_id,
      youtubeUrl: player.youtube_url,
      youtubeChannelId: player.youtube_channel_id,
    };
  }

  return null;
}

export async function upsertYoutubeVideo(
  supabase: SupabaseClient,
  owner: YoutubeVideoOwner,
  entry: YoutubeFeedEntry,
  options: { dryRun?: boolean } = {},
) {
  const table = owner.kind === "team" ? "team_videos" : "player_videos";
  const existing = await supabase
    .from(table)
    .select("id")
    .eq("youtube_video_id", entry.videoId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const payload =
    owner.kind === "team"
      ? {
          team_id: owner.id,
          platform: "youtube",
          title: entry.title,
          video_url: youtubeWatchUrl(entry.videoId),
          youtube_video_id: entry.videoId,
          embed_url: youtubeEmbedUrl(entry.videoId),
          thumbnail_url: entry.thumbnailUrl,
          published_at: entry.publishedAt,
          last_seen_at: new Date().toISOString(),
        }
      : {
          player_id: owner.id,
          team_id: owner.teamId,
          platform: "youtube",
          title: entry.title,
          video_url: youtubeWatchUrl(entry.videoId),
          youtube_video_id: entry.videoId,
          embed_url: youtubeEmbedUrl(entry.videoId),
          thumbnail_url: entry.thumbnailUrl,
          published_at: entry.publishedAt,
          last_seen_at: new Date().toISOString(),
        };

  if (options.dryRun) {
    return { inserted: !existing.data, title: entry.title };
  }

  if (existing.data) {
    const { error } = await supabase.from(table).update(payload).eq("id", existing.data.id);
    if (error) throw error;
    return { inserted: false, title: entry.title };
  }

  const { error } = await supabase.from(table).insert({ ...payload, is_new: true });
  if (error) throw error;
  return { inserted: true, title: entry.title };
}
