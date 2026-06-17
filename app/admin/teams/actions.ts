"use server";

import { revalidatePath } from "next/cache";

import { fanSiteHosts } from "@/lib/team-themes";
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

function ensureFanSiteHost(value: string) {
  if (!fanSiteHosts.includes(value as (typeof fanSiteHosts)[number])) {
    throw new Error("팬사이트 호스트는 고정 10개 값 중 하나만 사용할 수 있습니다.");
  }
}

function teamPayload(formData: FormData) {
  const fanSiteHost = requiredText(formData, "fanSiteHost", "팬사이트 호스트");
  ensureFanSiteHost(fanSiteHost);

  return {
    slug: requiredText(formData, "slug", "팀 상세 slug"),
    name: requiredText(formData, "name", "팀명"),
    short_name: requiredText(formData, "shortName", "축약명"),
    logo_url: textOrNull(formData.get("logoUrl")),
    logo_white_url: textOrNull(formData.get("logoWhiteUrl")),
    background_url: textOrNull(formData.get("backgroundUrl")),
    primary_color: requiredText(formData, "primaryColor", "기본 색상"),
    secondary_color: requiredText(formData, "secondaryColor", "보조 색상"),
    fan_site_host: fanSiteHost,
    official_homepage_url: textOrNull(formData.get("officialHomepageUrl")),
    official_youtube_url: textOrNull(formData.get("officialYoutubeUrl")),
    official_x_url: textOrNull(formData.get("officialXUrl")),
    official_instagram_url: textOrNull(formData.get("officialInstagramUrl")),
    leaguepedia_page: textOrNull(formData.get("leaguepediaPage")),
    source_team_id: textOrNull(formData.get("sourceTeamId")),
    head_coach: textOrNull(formData.get("headCoach")),
    coaches: textOrNull(formData.get("coaches")),
  };
}

export async function createTeamAction(formData: FormData) {
  const payload = teamPayload(formData);
  const { error } = await createSupabaseAdminClient().from("teams").insert(payload);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/teams");
  revalidatePath("/teams");
}

export async function updateTeamAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const payload = teamPayload(formData);
  const { error } = await createSupabaseAdminClient()
    .from("teams")
    .update(payload)
    .eq("id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath(`/teams/${payload.slug}`);
}

export async function createTeamIdentityHistoryAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const effectiveFrom = requiredText(formData, "effectiveFrom", "적용 시작일");
  const effectiveTo = textOrNull(formData.get("effectiveTo"));

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("적용 종료일은 시작일보다 빠를 수 없습니다.");
  }

  const { error } = await createSupabaseAdminClient().from("team_identity_histories").insert({
    team_id: teamId,
    name: requiredText(formData, "historyName", "변경 이력 팀명"),
    short_name: requiredText(formData, "historyShortName", "변경 이력 축약명"),
    slug: requiredText(formData, "historySlug", "변경 이력 slug"),
    logo_url: textOrNull(formData.get("historyLogoUrl")),
    sponsor_name: textOrNull(formData.get("sponsorName")),
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    note: textOrNull(formData.get("note")),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/teams");
}
