"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchPlayerSocialForPage } from "@/lib/sync/leaguepedia-player-social.ts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function revalidatePlayerPaths(playerId: string, slug?: string) {
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/players");
  if (slug) revalidatePath(`/players/${slug}`);
}

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

async function uploadProfileImage(playerId: string, file: File) {
  const supabase = createSupabaseAdminClient();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${playerId}/${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from("player-profiles").upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("player-profiles").getPublicUrl(path);
  return data.publicUrl;
}

export async function updatePlayerDetailAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const realName = textOrNull(formData.get("real_name"));
  const leaguepediaPage = textOrNull(formData.get("leaguepedia_page"));
  const teamId = textOrNull(formData.get("team_id"));
  const position = formData.get("position") as string;
  const isStarter = formData.get("is_starter") === "true";
  const profileImageUrlInput = textOrNull(formData.get("profile_image_url"));
  const profileImageFile = formData.get("profile_image_file");
  const slug = textOrNull(formData.get("slug")) ?? undefined;

  if (!id || !name || !position) return;

  const supabase = createSupabaseAdminClient();

  if (isStarter && teamId && position) {
    await supabase
      .from("players")
      .update({ is_starter: false })
      .eq("team_id", teamId)
      .eq("position", position)
      .eq("is_starter", true)
      .neq("id", id);
  }

  let profileImageUrl = profileImageUrlInput;
  if (profileImageFile instanceof File && profileImageFile.size > 0) {
    profileImageUrl = await uploadProfileImage(id, profileImageFile);
  }

  await supabase
    .from("players")
    .update({
      name,
      real_name: realName,
      leaguepedia_page: leaguepediaPage,
      source_player_id: leaguepediaPage ? `lp:${leaguepediaPage}` : null,
      team_id: teamId,
      position,
      is_starter: isStarter,
      profile_image_url: profileImageUrl,
      stream_url: textOrNull(formData.get("stream_url")),
      twitter_url: textOrNull(formData.get("twitter_url")),
      instagram_url: textOrNull(formData.get("instagram_url")),
      youtube_url: textOrNull(formData.get("youtube_url")),
      facebook_url: textOrNull(formData.get("facebook_url")),
      discord_url: textOrNull(formData.get("discord_url")),
    })
    .eq("id", id);

  revalidatePlayerPaths(id, slug ?? undefined);
  redirect(`/admin/players/${id}`);
}

export async function syncPlayerSocialFromLeaguepediaAction(formData: FormData) {
  const id = formData.get("id") as string;
  const leaguepediaPage = textOrNull(formData.get("leaguepedia_page"));
  const slug = textOrNull(formData.get("slug")) ?? undefined;

  if (!id || !leaguepediaPage) return;

  const social = await fetchPlayerSocialForPage(leaguepediaPage);
  if (social) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("players").update(social).eq("id", id);
  }

  revalidatePlayerPaths(id, slug ?? undefined);
  redirect(`/admin/players/${id}`);
}
