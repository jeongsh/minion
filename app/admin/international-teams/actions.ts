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

export async function updateInternationalTeamShortNameAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const shortName = requiredText(formData, "shortName", "약칭");

  const client = createSupabaseAdminClient();
  const { data: team, error: lookupError } = await client.from("teams").select("slug").eq("id", teamId).maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!team) {
    throw new Error("???李얠쓣 ???놁뒿?덈떎.");
  }

  const { error } = await client.from("teams").update({ short_name: shortName }).eq("id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  await refreshWeeklyReportTeamColor(client, team.slug);

  revalidatePath("/admin/international-teams");
  revalidatePath(`/admin/international-teams/${teamId}`);
  revalidatePath("/reports");
  revalidatePath("/teams");
  revalidatePath(`/teams/${team.slug}`);
}

function requiredHexColor(formData: FormData, key: string, label: string) {
  const value = requiredText(formData, key, label);
  const normalized = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized) && !/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    throw new Error(`${label}은(는) #RRGGBB 형식이어야 합니다.`);
  }
  // #RGB → #RRGGBB 확장 (color input은 6자리만 다룬다)
  if (normalized.length === 4) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return normalized.toUpperCase();
}

// 위클리 리포트 content에는 팀 색상이 비정규화돼 저장되므로, 색을 바꾸면 함께 갱신한다.
async function refreshWeeklyReportTeamColor(client: ReturnType<typeof createSupabaseAdminClient>, slug: string) {
  const { data: team } = await client
    .from("teams")
    .select("slug,name,short_name,logo_url,logo_white_url,primary_color")
    .eq("slug", slug)
    .maybeSingle();
  if (!team) return;

  const refresh = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(refresh);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.slug === slug && "color" in record && "shortName" in record) {
      record.color = team.primary_color;
      record.name = team.name;
      record.shortName = team.short_name;
      record.logoUrl = team.logo_url;
      record.logoWhiteUrl = team.logo_white_url;
    }
    Object.values(record).forEach(refresh);
  };

  const { data: reports } = await client.from("weekly_reports").select("id,content");
  for (const report of reports ?? []) {
    refresh(report.content);
    await client.from("weekly_reports").update({ content: report.content }).eq("id", report.id);
  }
}

export async function updateInternationalTeamColorsAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const primaryColor = requiredHexColor(formData, "primaryColor", "메인 컬러");
  const secondaryColor = requiredHexColor(formData, "secondaryColor", "보조 컬러");

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
    .update({ primary_color: primaryColor, secondary_color: secondaryColor })
    .eq("id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  await refreshWeeklyReportTeamColor(client, team.slug);

  revalidatePath("/admin/international-teams");
  revalidatePath(`/admin/international-teams/${teamId}`);
  revalidatePath("/reports");
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
