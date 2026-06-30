"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = textOrNull(formData.get(key));

  if (!value) {
    throw new Error(`${label} 값은 필수입니다.`);
  }

  return value;
}

export async function updateInternationalTeamMediaAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const logoUrl = requiredText(formData, "logoUrl", "로고 URL");
  const profileImageUrl = textOrNull(formData.get("profileImageUrl"));

  const client = createSupabaseAdminClient();
  const { data: team, error: lookupError } = await client.from("teams").select("slug").eq("id", teamId).maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!team) {
    throw new Error("팀을 찾을 수 없습니다.");
  }

  const { error } = await client
    .from("teams")
    .update({
      logo_url: logoUrl,
      profile_image_url: profileImageUrl,
    })
    .eq("id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/international-teams");
  revalidatePath(`/admin/international-teams/${teamId}`);
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath(`/teams/${team.slug}`);
}

export async function updateInternationalPlayerImageAction(formData: FormData) {
  const playerId = requiredText(formData, "playerId", "선수 ID");
  const profileImageUrl = textOrNull(formData.get("profileImageUrl"));

  const client = createSupabaseAdminClient();
  const { data: player, error: lookupError } = await client
    .from("players")
    .select("slug, team_id, teams(slug)")
    .eq("id", playerId)
    .maybeSingle<{ slug: string; team_id: string | null; teams: { slug: string } | null }>();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!player) {
    throw new Error("선수를 찾을 수 없습니다.");
  }

  const { error } = await client
    .from("players")
    .update({ profile_image_url: profileImageUrl })
    .eq("id", playerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/international-teams");
  if (player.team_id) {
    revalidatePath(`/admin/international-teams/${player.team_id}`);
  }
  revalidatePath(`/players/${player.slug}`);
  if (player.teams?.slug) {
    revalidatePath(`/teams/${player.teams.slug}`);
  }
}
