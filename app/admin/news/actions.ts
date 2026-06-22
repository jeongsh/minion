"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function revalidate() {
  revalidatePath("/admin/news");
  revalidatePath("/");
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
  } catch {}
  return null;
}

export async function createVideoAction(formData: FormData) {
  const teamId = formData.get("team_id") as string;
  const platform = formData.get("platform") as string;
  const title = (formData.get("title") as string).trim();
  const videoUrl = (formData.get("video_url") as string).trim();
  const thumbnailUrl = (formData.get("thumbnail_url") as string).trim() || null;
  const publishedAt = (formData.get("published_at") as string) || null;
  const viewCount = Number(formData.get("view_count")) || 0;

  if (!teamId || !platform || !title || !videoUrl) return;

  const youtubeVideoId = platform === "youtube" ? extractYoutubeId(videoUrl) : null;
  const embedUrl = youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : null;
  const finalThumb =
    thumbnailUrl ||
    (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg` : null);
  const now = new Date().toISOString();

  const supabase = createSupabaseAdminClient();
  await supabase.from("team_videos").insert({
    team_id: teamId,
    platform,
    title,
    video_url: videoUrl,
    thumbnail_url: finalThumb,
    published_at: publishedAt || now,
    view_count: viewCount,
    youtube_video_id: youtubeVideoId,
    embed_url: embedUrl,
    is_new: true,
    first_seen_at: now,
    last_seen_at: now,
  });

  revalidate();
}

export async function updateVideoAction(formData: FormData) {
  const id = formData.get("id") as string;
  const teamId = formData.get("team_id") as string;
  const platform = formData.get("platform") as string;
  const title = (formData.get("title") as string).trim();
  const videoUrl = (formData.get("video_url") as string).trim();
  const thumbnailUrl = (formData.get("thumbnail_url") as string).trim() || null;
  const publishedAt = (formData.get("published_at") as string) || null;
  const viewCount = Number(formData.get("view_count")) || 0;

  if (!id || !teamId || !platform || !title || !videoUrl) return;

  const youtubeVideoId = platform === "youtube" ? extractYoutubeId(videoUrl) : null;
  const embedUrl = youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : null;
  const finalThumb =
    thumbnailUrl ||
    (youtubeVideoId ? `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg` : null);

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("team_videos")
    .update({
      team_id: teamId,
      platform,
      title,
      video_url: videoUrl,
      thumbnail_url: finalThumb,
      published_at: publishedAt,
      view_count: viewCount,
      youtube_video_id: youtubeVideoId,
      embed_url: embedUrl,
    })
    .eq("id", id);

  revalidate();
}

export async function deleteVideoAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const supabase = createSupabaseAdminClient();
  await supabase.from("team_videos").delete().eq("id", id);
  revalidate();
}

export async function createPostAction(formData: FormData) {
  const boardType = formData.get("board_type") as string;
  const siteScope = formData.get("site_scope") as string;
  const teamId = (formData.get("team_id") as string) || null;
  const title = (formData.get("title") as string).trim();
  const content = (formData.get("content") as string).trim();

  if (!boardType || !siteScope || !title || !content) return;

  const supabase = createSupabaseAdminClient();
  await supabase.from("community_posts").insert({
    board_type: boardType,
    site_scope: siteScope,
    team_id: teamId || null,
    title,
    content,
    like_count: 0,
    comment_count: 0,
    view_count: 0,
  });

  revalidate();
}

export async function updatePostAction(formData: FormData) {
  const id = formData.get("id") as string;
  const boardType = formData.get("board_type") as string;
  const siteScope = formData.get("site_scope") as string;
  const teamId = (formData.get("team_id") as string) || null;
  const title = (formData.get("title") as string).trim();
  const content = (formData.get("content") as string).trim();

  if (!id || !boardType || !siteScope || !title) return;

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("community_posts")
    .update({
      board_type: boardType,
      site_scope: siteScope,
      team_id: teamId || null,
      title,
      content,
    })
    .eq("id", id);

  revalidate();
}

export async function deletePostAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;
  const supabase = createSupabaseAdminClient();
  await supabase.from("community_posts").delete().eq("id", id);
  revalidate();
}
