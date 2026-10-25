import "server-only";
import { unstable_cache } from "next/cache";
import { getFanVideoFeed, getTeamInstagramFeed, getPlayers, getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { buildFanVideoItems, type FanVideoItem } from "@/lib/fan-video-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TeamSocialPost, PlayerSocialPost } from "@/lib/types";

export type MediaKind = "videos" | "instagram";
export type MediaCursor = { team: number; player: number };
export type MediaPage = { videos: FanVideoItem[]; teamPosts: TeamSocialPost[]; playerPosts: PlayerSocialPost[]; next: MediaCursor | null };
export type MediaTab = { key: string; label: string; count: number };
const PAGE_SIZE = 12;

async function context(teamSlug: string) {
  const team = await getTeamByFanSiteHost(teamSlug) ?? await getTeamBySlug(teamSlug);
  if (!team) throw new Error("팀을 찾을 수 없습니다.");
  return { team, players: (await getPlayers()).filter(player => player.teamId === team.id) };
}

export const getMediaTabs = unstable_cache(async (teamSlug: string, kind: MediaKind): Promise<MediaTab[]> => {
  const { team, players } = await context(teamSlug);
  const client = createSupabaseServerClient();
  const count = async (playerId?: string) => {
    const table = kind === "videos" ? playerId ? "player_videos" : "team_videos" : playerId ? "player_social_posts" : "team_social_posts";
    let query = client.from(table).select("id", { count: "exact", head: true }).eq("team_id", team.id);
    if (playerId) query = query.eq("player_id", playerId);
    if (kind === "instagram") query = query.eq("platform", "instagram");
    const result = await query;
    if (result.error) {
      if (result.error.code === "PGRST205") return 0;
      throw result.error;
    }
    return result.count ?? 0;
  };
  const [teamCount, ...playerCounts] = await Promise.all([count(), ...players.map(player => count(player.id))]);
  const tabs: MediaTab[] = [ { key: team.shortName, label: "구단", count: teamCount }, ...players.map((player, i) => ({ key: player.name, label: player.name, count: playerCounts[i] })).sort((a, b) => a.label.localeCompare(b.label, "ko")) ].filter(tab => tab.count > 0);
  return [{ key: "all", label: "전체", count: tabs.reduce((sum, tab) => sum + tab.count, 0) }, ...tabs];
}, ["fan-media-tab-counts"], { revalidate: 60 });

export async function getMediaPage(teamSlug: string, kind: MediaKind, owner = "all", cursor: MediaCursor = { team: 0, player: 0 }): Promise<MediaPage> {
  const { team, players } = await context(teamSlug);
  const player = players.find(item => item.name === owner);
  if (owner !== "all" && owner !== team.shortName && !player) throw new Error("선수를 찾을 수 없습니다.");
  const ownerId = owner === "all" ? undefined : owner === team.shortName ? "team" : player!.id;
  const playerIds = players.map(item => item.id);
  const empty = { videos: [], teamPosts: [], playerPosts: [] };
  if (kind === "videos") {
    const feed = await getFanVideoFeed(team.id, playerIds, PAGE_SIZE + 1, cursor, ownerId);
    const all = buildFanVideoItems({ team, players, ...feed });
    const videos = all.slice(0, PAGE_SIZE);
    const next = all.length > PAGE_SIZE ? { team: cursor.team + videos.filter(item => item.ownerType === "team").length, player: cursor.player + videos.filter(item => item.ownerType === "player").length } : null;
    return { ...empty, videos, next };
  }
  const feed = await getTeamInstagramFeed(team.id, playerIds, PAGE_SIZE + 1, cursor, ownerId);
  const all = [...feed.teamPosts.map(item => ({ id: item.id, owner: "team", date: item.publishedAt })), ...feed.playerPosts.map(item => ({ id: item.id, owner: "player", date: item.postedAt }))].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const selected = all.slice(0, PAGE_SIZE);
  const teamIds = new Set(selected.filter(item => item.owner === "team").map(item => item.id));
  const playerPostIds = new Set(selected.filter(item => item.owner === "player").map(item => item.id));
  return { ...empty, teamPosts: feed.teamPosts.filter(item => teamIds.has(item.id)), playerPosts: feed.playerPosts.filter(item => playerPostIds.has(item.id)), next: all.length > PAGE_SIZE ? { team: cursor.team + teamIds.size, player: cursor.player + playerPostIds.size } : null };
}
